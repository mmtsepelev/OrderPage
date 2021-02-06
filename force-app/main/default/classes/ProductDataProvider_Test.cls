@isTest
public with sharing class ProductDataProvider_Test {

    private static final Integer ORDERS_NUM = 10;   // Number of Order records for the tests
    private static final Integer PRODUCTS_NUM = 10; // Number of ProducItems per Order
    
    /* Method creates all test records used by tests */ 
    @testSetup 
    static void createTestData() {
        TestUtils.createTestData(ORDERS_NUM, PRODUCTS_NUM);
    }


    /* Test if getProductsBlock returns record blocks by specified offset and size. */
    @isTest
    public static void Test_GetProductsData(){

        /* Initial Offset for the query in getProductsBlock method. */
        final Integer OFFSET = 0;     
        
        /* Select singe Order for test */
        Order order = [SELECT Id, OrderNumber FROM Order LIMIT 1];

        /* Call method under test */
        ProductDataProvider.ProductDataBlock dataBlock = ProductDataProvider.getProductsData(order.Id, OFFSET);
        
        /* Test if method returns valid number of records */
        System.assertEquals(PRODUCTS_NUM, dataBlock.pbeSize);
        System.assertEquals(PRODUCTS_NUM, dataBlock.productList.size());
    }


    /* Test if upsertOrderItems method accepts selected records JSON and upserts them to database. */
    @isTest
    public static void Test_UpsertOrderItems(){

        /* Select singe Order and related OrderItems for test */
        Order order = [SELECT Id, OrderNumber, (SELECT Product2Id, Product2.Name, PricebookEntryId, UnitPrice FROM OrderItems) FROM Order LIMIT 1];

        /* Build selection rows object to be serialized and passed to upsertOrderItems method. */
        List<Map<String, Object>> selectionList = new List<Map<String, Object>>();
        for(OrderItem item : order.OrderItems){
            Map<String, Object> entry = new Map<String, Object>{'pbeId'=>item.PricebookEntryId, 'Product2Id'=>item.Product2Id, 'productName'=>item.Product2.Name, 'productPrice'=>item.UnitPrice };
            selectionList.add(entry);
        }

        Test.startTest();
            /* Call method under test with own limits. */
            List<OrderItem> orderItems = ProductDataProvider.upsertOrderItems(Order.Id, JSON.serialize(selectionList));
        Test.stopTest();
        
        /* Test if all OrderItems upserted succesfully */
        System.assertEquals(PRODUCTS_NUM, orderItems.size());
    }
}
