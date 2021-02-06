/* This class provides data objects to show in the lightning-datatable on AvailableProducts component.
* Table loads required data by blocks of defined size when user scrolls down throught the records. */
public with sharing class ProductDataProvider {
    
    private static final Integer DATA_BLOCK_SIZE = 50; /* Number of records loaded by loadMore call on table scrolling. */
    
    
    /* Wrapper class to hold product data block information collected by SOQL queries from different objects.
    * It will be passed in AvailableProducts LWC component to be shown in the table. */
    public class ProductDataBlock {
        /* Total Pricebook entries count */
        @AuraEnabled public Integer pbeSize;
        /* Pricebook entries data, holds actual data for the table */
        @AuraEnabled public List<ProductData> productList;
    
        public ProductDataBlock() {
            productList = new List<ProductData>();
        }
    }
    
    /* Wrapper class to hold product data collected by SOQL queries in getProductsBlock method. */
    public class ProductData {
        @AuraEnabled public Id pbeId;
        @AuraEnabled public Id Product2Id;
        @AuraEnabled public String productName;
        @AuraEnabled public Decimal productPrice;
    
        public ProductData() { }
            
        public ProductData(Id pbeId, Id Product2Id, String productName, Decimal productPrice){
            this.pbeId = pbeId;
            this.Product2Id = Product2Id;
            this.productName = productName;
            this.productPrice = productPrice;
        }
    }

    /* Use cacheble=false since we dont want data to be cached in LDS, otherwise it will be possible that
    * same items could be shown several times in the table because of LDS cache is not updated by framework. */
    @AuraEnabled(cacheable=false)
    public static ProductDataBlock getProductsData(Id orderId, Integer offset){
        try {
            return ProductDataProvider.getProductsBlock(orderId, offset, DATA_BLOCK_SIZE);
        } catch (Exception e) {
            /* Rethow exception to be shown in error toast in the component. */
            throw new AuraHandledException(e.getMessage());
        }
    }
    
    /* Method to collect Pricebook entries data and pack it to wrapper class to be passed to AvailableProducts LWC component. 
    * @param: orderId - Id of current order.
    * @param: offset - offset for SOQL query to get sequential data block.
    * @param: size - data block size.
    * @returns: ProductDataBlock class instance holding actual data block and total PB entries size. */
    public static ProductDataBlock getProductsBlock(Id orderId, Integer offset, Integer size) {
    
        /* Get PricebookID associated with current Order. 
        *  Will be used to get Pricebook entries. */
        Order ord = [SELECT Pricebook2Id FROM Order WHERE Id =: orderId];
        Id pricebookId = ord.Pricebook2Id;
            
        /* Query to get total number of active Pricebook enties. 
        *  Will be used to stop scrolling in lightning-datatable UI element if last record is reached.
        *  This query is done in the same JS request with actual data query in order to minimize number of requests. */ 
        AggregateResult results = [SELECT COUNT(Id) total
                                        FROM PricebookEntry
                                        WHERE Pricebook2Id =: pricebookId
                                        AND IsActive =: true];
            
        Integer pbeSize = (Integer)results.get('total');
            
        /* Query to get actual Pricebook entries block with defined offset */
        List<PricebookEntry> pbeList = [SELECT Id,
                                            Product2Id,
                                            Product2.Name,
                                            UnitPrice,
                                            IsActive
                                            FROM PricebookEntry
                                            WHERE Pricebook2Id =: pricebookId
                                            AND IsActive =: true
                                            ORDER BY Name
                                            LIMIT :size
                                            OFFSET :offset];
            
        ProductDataBlock pdb = new ProductDataBlock();
        pdb.pbeSize = pbeSize;
        for(PricebookEntry pbe : pbeList){
            pdb.productList.add(new ProductData(pbe.Id, pbe.Product2Id, pbe.Product2.Name, pbe.UnitPrice));
        }
    
        return pdb;
    }

    /* Method gets line items of current Order. */
    @AuraEnabled(cacheable=false)
    public static List<OrderItem> getOrderItems(Id OrderId){

        List<OrderItem> orderItems = [SELECT Id, 
                                            OrderId, 
                                            Order.TotalAmount, 
                                            Product2Id, 
                                            Product2.Name, 
                                            Quantity, 
                                            UnitPrice, 
                                            TotalPrice 
                                            FROM OrderItem 
                                            WHERE OrderId =: OrderId
                                            ORDER BY LastModifiedDate DESC];
        return orderItems;
    }


    /* Methods upserts the list of newly added and updated products from selection and returns succesfully upserted records.
    * Caching is disabled in order to get only actual records from database instead of cached in LDS. */
    @AuraEnabled(cacheable=false)
    public static List<OrderItem> upsertOrderItems(Id OrderId, String selectionJSON){
        try{
            List<ProductData> selection = (List<ProductData>)JSON.deserialize(selectionJSON, List<ProductData>.class);
            List<OrderItem> existingItems = getOrderItems(OrderId);
            List<OrderItem> upsertItems = new List<OrderItem>();
            
            Map<Id, OrderItem> existingIdsMap = new Map<Id, OrderItem>();
            for(OrderItem item : existingItems){
                existingIdsMap.put(item.Product2Id, item);
            }

            for(ProductData item : selection){
                OrderItem oi = existingIdsMap.get(item.Product2Id);
                if(oi!=null){
                    oi.Quantity = oi.Quantity + 1;
                    upsertItems.add(oi);
                }else{
                    upsertItems.add(new OrderItem(PricebookEntryId= item.pbeId, OrderId = OrderId, Product2Id = item.Product2Id ,UnitPrice = item.productPrice, Quantity = 1));
                }
            }

            
            for(OrderItem item : upsertItems){
                System.Debug('Upserting: '+item);
            }
            
            upsert upsertItems;
            return getOrderItems(OrderId);
        } catch (Exception e) {
            /* Rethrow exception to LWC component to show error toast in case if upsert fails. */
            throw new AuraHandledException(e.getMessage());
        }
    }

}