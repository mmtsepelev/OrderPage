public with sharing class TestUtils {
    /* Method creates Order records and all necessary related records to be used by unit tests. */
    public static void createTestData(Integer ordersNum, Integer productsNum) {
        Account acc = new Account(Name='Test');
        insert acc;

        // Create test Orders for Account
        Id pbId = Test.getStandardPricebookId();
        List<Order> orders= new List<Order>();
        for(Integer i=0; i<ordersNum; i++)
        {
            orders.add(new Order( Pricebook2Id = pbId, AccountId = acc.Id, EffectiveDate = Date.today(), Status='Draft', Reconfirm__c = true, Retries__c = 0));
        }
        insert orders;

        // Create Products for standard PriceBook entries
        List<Product2> prods = new List<Product2>();
            for(Integer i = 0; i< productsNum; i++){
            prods.add(new Product2(Name = 'Product '+i, isActive=true));
        }
        insert prods;

        // Create standard PriceBook entries
        List<PricebookEntry> pbes = new List<PricebookEntry>();
        for(Integer i=0; i<productsNum; i++){
            pbes.add(new PricebookEntry(Pricebook2Id = pbId, Product2Id = prods[i].Id, UnitPrice = Math.random()*100, IsActive = true));
        }
        insert pbes;

        List<OrderItem> orderItems = new List<OrderItem>();
        for(Order order : orders){
            for(Integer i = 0; i< productsNum; i++){
                orderItems.add(new OrderItem(OrderId = order.Id, Product2Id = prods[i].Id, PricebookEntryId = pbes[i].Id, Quantity = 1, UnitPrice = Math.random()*100));
            }
        }
        insert orderItems;
    }
}
