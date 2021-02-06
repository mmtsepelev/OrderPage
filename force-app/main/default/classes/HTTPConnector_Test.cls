/* Test class for HTTPConnector class features. */
@isTest
public with sharing class HTTPConnector_Test {
    private static final Integer ORDERS_NUM = 1;            // Number of Order records to be used by tests
    private static final Integer PRODUCTS_NUM = 10;         // Number Products per Order to be used by tests
    private static final Integer SUCCESS_RESPONSE = 200;    // Success HTTP response code
    private static final Integer ERROR_RESPONSE = 500;      // Error HTTP response code

    /* Create test records for each test. */ 
    @testSetup 
    static void createTestData() {
        TestUtils.createTestData(ORDERS_NUM, PRODUCTS_NUM);
    }

    @isTest
    public static void Test_ConfirmRequest(){
        Integer responseCode;
        Order order = [SELECT Id, Status FROM Order];
        /* Set HTTP mock object for the test since we are making callouts. */
        Test.setMock(HttpCalloutMock.class, new ConfirmResponseMock(SUCCESS_RESPONSE));

        /* Run actual test with new set if limits. */
        Test.startTest();
            responseCode = HTTPConnector.confirmOrder(order.Id);
        Test.stopTest();

        /* Query for updated Order from database. */
        Order updateOrder = [SELECT Id, Status FROM Order];

        /* Test if Order was updated properly for successful response. */
        System.assertEquals(SUCCESS_RESPONSE, responseCode);
        System.assertEquals('Activated', updateOrder.Status);
    }

}
