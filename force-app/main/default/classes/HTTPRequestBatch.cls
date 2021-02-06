/* Self restarting Batch class to retry confirmation requests to external system in case of errors. 
* It should be started once before the solution is going to be used and will collect Order records not updated successfully
* by HTTP requests quit with errors or exceptions. */
global with sharing class HTTPRequestBatch implements Database.Batchable<SObject>, Database.AllowsCallouts, Database.Stateful {
    private static final String JOB_NAME = 'ConfirmRequest_Batch';
    private static final Integer SCOPE_SIZE = 100;
    private static final Integer RETRY_INTERVAL = 1;
    private static final Integer MAX_RETRY_REQUESTS = 5;
    private static String query = 'SELECT Status, Reconfirm__c, Retries__c FROM Order WHERE Status != \'Activated\' AND Reconfirm__c = true AND Retries__c <: MAX_RETRY_REQUESTS';
    
    /* Order records for which retry request was successful. */
    private List<Order> successList;

    public HTTPRequestBatch(){
        this.successList = new List<Order>();
    }

    global Database.QueryLocator start(Database.BatchableContext bc) {
        return Database.getQueryLocator(query);
    }

    global void execute(Database.BatchableContext bc, List<Order> scope) {
        
        /* Make callouts and populate successful requests list. */
        for(Order order : scope){
            if(HTTPConnector.confirmOrder(order.Id) == 200){
                this.successList.add(order);
            }
        }
    }

    global void finish(Database.BatchableContext bc) {
        /* Update successfully confirmed records after batch completes. */
        for(Order order : this.successList){
            order.Status = 'Activated';
            order.Reconfirm__c = false;
            order.Retries__c = 0;
        }
        update this.successList;

        /* Schedule next batch execution. */
        repeat();
    }
    
    /* Schedule next batch execution after defined timeout. */
    private static void repeat() {
        /* Kill previous job if exists. */
        List<CronTrigger> jobs = [SELECT Id, CronJobDetail.Name FROM CronTrigger WHERE CronJobDetail.Name =: JOB_NAME];
            if(!jobs.isEmpty()) {
                for(CronTrigger ct : jobs){
                    System.abortJob(ct.Id);
                }
            }
    
        /* Schedule next execution. */
        System.scheduleBatch(new HTTPRequestBatch(), JOB_NAME, RETRY_INTERVAL, SCOPE_SIZE);
    }

    /* Use this method to initally start the job from developer console. */
    public static void run(){
        HTTPRequestBatch batch = new HTTPRequestBatch();
        Id batchId = Database.executeBatch(batch, SCOPE_SIZE);
    }
}