@isTest
public with sharing class HTTPRequestBatch_Test {
    private static final Integer BATCH_SIZE = 100;
    private static final Integer PRODUCTS_NUM = 10;

    @testSetup 
    static void createTestData() {
        Account acc = new Account(Name='Test');
        insert acc;

        // Create test Orders for Account
        Id pbId = Test.getStandardPricebookId();
        List<Order> orders= new List<Order>();
        for(Integer i=0; i<BATCH_SIZE; i++)
        {
            orders.add(new Order( Pricebook2Id = pbId, AccountId = acc.Id, EffectiveDate = Date.today(), Status='Draft', RetryConfirm__c = 0));
        }
        insert orders;

        // Create Products for standard PriceBook entries
        List<Product2> prods = new List<Product2>();
            for(Integer i = 0; i< PRODUCTS_NUM; i++){
            prods.add(new Product2(Name = 'Product '+i, isActive=true));
        }
        insert prods;

        // Create standard PriceBook entries
        List<PricebookEntry> pbes = new List<PricebookEntry>();
        for(Integer i=0; i<PRODUCTS_NUM; i++){
            pbes.add(new PricebookEntry(Pricebook2Id = pbId, Product2Id = prods[i].Id, UnitPrice = Math.random()*100));
        }
        insert pbes;

        List<OrderItem> orderItems = new List<OrderItem>();
        for(Order order : orders){
            for(Integer i = 0; i< PRODUCTS_NUM; i++){
                orderItems.add(new OrderItem(OrderId = order.Id, Product2Id = prods[i].Id, PricebookEntryId = pbes[i].Id, Quantity = 1, UnitPrice = Math.random()*100));
            }
        }
        insert orderItems;
    }

    @isTest
    static void testBatch() 
    {
        Test.setMock(HttpCalloutMock.class, new ConfirmResponseMock());
            Test.startTest();
            HTTPRequestBatch.run();
        Test.stopTest();


    }
}
