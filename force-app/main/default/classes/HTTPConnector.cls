/** Utility class encapsulating HTTP connection methods and data.
 * Connection data is stored in custom metadata type.
*/

public with sharing class HTTPConnector {

    private static final String CONNECTION_SETTINGS = 'requestcatcher';

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

    /* Reason to use imperative call ? */
    @AuraEnabled(cacheable=false)
    public static Integer confirmOrder(Id orderId){
        try {
            Order order = [SELECT Account.AccountNumber, 
                    OrderNumber, 
                    Type, 
                    Status, 
                    RetryConfirm__c,
                    (SELECT Product2.Name, Product2.ProductCode, UnitPrice, Quantity FROM OrderItems) 
                    FROM Order 
                    WHERE Id =: orderId];

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

            HttpResponse resp = doCallout(body);
            /* If success - update Order Status to Active ( optionally udate order items to be linked to the order. */
            Integer statusCode = resp.getStatusCode();
            System.Debug('HTTP Request statusCode: ' + statusCode);
            if(statusCode == 200){
                order.Status = 'Activated';
                order.RetryConfirm__c = 0;
            }else{
                order.RetryConfirm__c = order.RetryConfirm__c + 1;
            }

            // Skip update if method is called from batch 
            if(!System.isBatch()){
                update order;
            }
            
            return statusCode;
        } catch (Exception e) {
            /* If callout failed, update Order to be picked up by batch job to retry the request and re-throw exception
            ** to LWC component to show error toast. */
            System.Debug(e.getMessage());
            throw new AuraHandledException(e.getMessage());
        }
    }
    
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
