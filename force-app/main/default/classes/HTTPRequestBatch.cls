global with sharing class HTTPRequestBatch implements Database.Batchable<SObject>, Database.AllowsCallouts, Database.Stateful {
    private static final String JOB_NAME = 'ConfirmRequest_Batch';
    private static final Integer SCOPE_SIZE = 100;
    private static final Integer RETRY_INTERVAL = 1;
    private static final Integer MAX_RETRY_REQUESTS = 5;
    private static String query = 'SELECT Status, RetryConfirm__c FROM Order WHERE Status != \'Activated\' AND RetryConfirm__c <: MAX_RETRY_REQUESTS';
    
    private List<Order> successList;

    public HTTPRequestBatch(){
        this.successList = new List<Order>();
    }

    global Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator(query);
    }

    global void execute(Database.BatchableContext bc, List<Order> scope) {
        
        // Make callouts for Orders and populate successful requests list
        for(Order order : scope){
            if(HTTPConnector.confirmOrder(order.Id) == 200){
                this.successList.add(order);
            }
        }
    }

    global void finish(Database.BatchableContext bc) {
        for(Order order : this.successList){
            order.Status = 'Activated';
        }
        update this.successList;

        // Schedule next batch execution
        repeat();
    }
     
    private static void repeat() {
        // Kill previous job if exists
        List<CronTrigger> jobs = [SELECT Id, CronJobDetail.Name FROM CronTrigger WHERE CronJobDetail.Name =: JOB_NAME];
            if(!jobs.isEmpty()) {
                for(CronTrigger ct : jobs){
                    System.abortJob(ct.Id);
                }
            }
    
        System.scheduleBatch(new HTTPRequestBatch(), JOB_NAME, RETRY_INTERVAL, SCOPE_SIZE);
    }

    public static void run(){
        HTTPRequestBatch batch = new HTTPRequestBatch();
        Id batchId = Database.executeBatch(batch, SCOPE_SIZE);
    }
}
    