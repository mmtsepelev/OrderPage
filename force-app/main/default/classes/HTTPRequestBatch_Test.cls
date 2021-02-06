@isTest
public with sharing class HTTPRequestBatch_Test {
    private static final Integer BATCH_SIZE = 100;
    private static final Integer PRODUCTS_NUM = 10;

    /* Create test records for each test. */ 
    @testSetup 
    static void createTestData() {
        TestUtils.createTestData(BATCH_SIZE, PRODUCTS_NUM);
    }

    @isTest
    static void Test_Batch() 
    {
        /* Set HTTP mock object for the test since we are making callouts. */
        Test.setMock(HttpCalloutMock.class, new ConfirmResponseMock());

        Test.startTest();
            /* Run batch under test. */
            HTTPRequestBatch.run();
        Test.stopTest();

        /* Test if Orders were activated. */
        for(Order order : [SELECT Id, Status FROM Order]){
            System.assertEquals('Activated', order.Status);
        }
    }
}
