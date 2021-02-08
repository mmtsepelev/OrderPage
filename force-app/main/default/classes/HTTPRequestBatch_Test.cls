/* Test class for HTTPRequestBatch features. */
@isTest
public with sharing class HTTPRequestBatch_Test {
    private static final Integer BATCH_SIZE = 100;          // Number of Order records to be processed by batch
    private static final Integer PRODUCTS_NUM = 10;         // Number of Products per Order in test
    private static final Integer SUCCESS_RESPONSE = 200;    // Success HTTP response code
    private static final Integer ERROR_RESPONSE = 500;      // Error HTTP response code


    /* Create test records for each test. */ 
    @testSetup 
    static void createTestData() {
        TestUtils.createTestData(BATCH_SIZE, PRODUCTS_NUM);
    }

    @isTest
    static void Test_SuccessfulResponse() 
    {
        /* Set HTTP mock object for the test since we are making callouts. */
        Test.setMock(HttpCalloutMock.class, new ConfirmResponseMock(SUCCESS_RESPONSE));

        Test.startTest();
            /* Run batch under test. */
            HTTPRequestBatch.run();
        Test.stopTest();

        /* Test if Orders were activated. */
        for(Order order : [SELECT Id, Status, Reconfirm__c FROM Order]){
            System.assertEquals('Activated', order.Status);
        }
    }

    @isTest
    static void Test_ErrorResponse() 
    {
        /* Set HTTP mock object for the test since we are making callouts. */
        Test.setMock(HttpCalloutMock.class, new ConfirmResponseMock(ERROR_RESPONSE));

        Test.startTest();
            /* Run batch under test. */
            HTTPRequestBatch.run();
        Test.stopTest();

        /* Test if Orders were activated. */
        for(Order order : [SELECT Id, Status, Reconfirm__c FROM Order]){
            System.assertEquals('Draft', order.Status);
            System.assertEquals(true, order.Reconfirm__c);
        }
    }
}
