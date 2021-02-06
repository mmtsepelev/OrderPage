/* Mock HTTP callout class to be used by unit tests. */
@isTest
global class ConfirmResponseMock implements HttpCalloutMock {
    private Integer statusCode;

    global ConfirmResponseMock(Integer statusCode){
        this.statusCode = statusCode;
    }
    /* Implement mock interface method. */
    global HTTPResponse respond(HTTPRequest req) {
        
        /* Create mock response. */
        HttpResponse res = new HttpResponse();
        res.setBody('{"message":"test"}');
        res.setStatusCode(this.statusCode);
        return res;
    }
}