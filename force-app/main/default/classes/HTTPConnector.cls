/* Utility class encapsulating HTTP connection methods and data.
 * Connection data like URL and method are stored in Connection_Setting__mdt custom metadata record. */

public with sharing class HTTPConnector {

    /* Custom metadata records name which holds URL and method name. */
    private static final String CONNECTION_SETTINGS = 'requestcatcher';

    /* Request body class to be serialized and sent in HTTP request. */
    public class RequestBody {
        Map<String, Object> body;

        public RequestBody(String accountNumber, String orderNumber, String type, String status, List<Map<String,Object>> products){
            body = new Map<String, Object>();
            body.put('accountNumber', accountNumber);
            body.put('orderNumber', orderNumber);
            body.put('type', type);
            body.put('status', status);
            body.put('orderProducts', products);
        }

        public String toJSONString(){
            return JSON.serialize(body);
        }
    }


    /* Request class incapsulates HTTP request data like URL, method, request body and execute() method which does actual request. */ 
    public class Request {
        String endpoint;
        String method;
        RequestBody body;

        public Request (String endpoint, String method, RequestBody body){
            this.endpoint = endpoint;
            this.method = method;
            this.body = body;
        }

        public HttpResponse execute() {
            Http http = new Http();
            HttpRequest request = new HttpRequest();
            request.setEndpoint(this.endpoint);
            request.setMethod(this.method);
            request.setBody(this.body.toJSONString());
            HttpResponse response;
            response = http.send(request);
            return response;
        }
    }


    /* This method is called if Confirm button is pressed in CurrentOrder component. */
    @AuraEnabled(cacheable=false)
    public static Integer confirmOrder(Id orderId){

        /* Get Order record with related OrderItems. */
        Order order = [SELECT Account.AccountNumber, 
                                OrderNumber, 
                                Type, 
                                Status, 
                                Reconfirm__c,
                                Retries__c,
                                (SELECT Product2.Name, Product2.ProductCode, UnitPrice, Quantity FROM OrderItems) 
                                FROM Order 
                                WHERE Id =: orderId];
            
            try{
                return confirmOrderRequest(order);
            } catch (Exception e) {
                /* If callout fails, update Order to be picked up by batch job to retry the request and re-throw exception
                ** to LWC component to show error toast. */
                if(!System.isBatch()){
                    order.Reconfirm__c = true;
                    update order;
                }
    
                System.Debug(e.getMessage());
                throw new AuraHandledException(e.getMessage());
            }
    
    }


    /* This method does HHTP request to external system with requred JSON request body assembled from Ored and related
    * OrderItems records data.
    * @param: orderId - Id of the Order to be confirmed in external system.
    * @return: StatusCode of HTTP request. It will be used to update Order Status in UI for successful request.*/
    public static Integer confirmOrderRequest(Order order){
        /* Build request body object to be sirialized in request and fill it with Order data. */
        List<Map<String,Object>> products = new List<Map<String,Object>>();
        for(OrderItem item : order.OrderItems){
            Map<String,Object> field = new Map<String,Object>();
            field.put('name', item.Product2.Name);
            field.put('code', item.Product2.ProductCode);
            field.put('unitPrice', item.UnitPrice);
            field.put('quantity', item.Quantity);
            products.add(field);
        }

        RequestBody body = new RequestBody(order.Account.AccountNumber, order.OrderNumber, order.Type, order.Status, products);

        /* Send HTTP request to confirm Order in external system. */ 
        HttpResponse resp = doCallout(body);

        Integer statusCode = resp.getStatusCode();

        /* If success - update Order Status to Active and reset fields processed by batch. */
        if(statusCode == 200){
            order.Status = 'Activated';
            order.Reconfirm__c = false;
            order.Retries__c = 0;
        }else{
            /* If server returned an error status code - increment retries number and set 
            * Reconfirm field in order for record to be picked up by batch job to retry the request after defined time. */
            order.Reconfirm__c = true;
        }

        /* Skip update if method is called from batch context. */
        if(!System.isBatch()){
            update order;
        }
            
        return statusCode;
    }
    

    /* Method reads connection settings from custom metadata and executes the request with provided request body. */
    public static HttpResponse doCallout (RequestBody body) {
        Connection_Setting__mdt setting = [SELECT DeveloperName, endpoint__c, method__c 
                                                FROM Connection_Setting__mdt 
                                                WHERE DeveloperName = : CONNECTION_SETTINGS];
        String endpoint = setting.endpoint__c; 
        String method = setting.method__c;
        Request req = new Request(endpoint, method, body);
        return req.execute();
    }

}