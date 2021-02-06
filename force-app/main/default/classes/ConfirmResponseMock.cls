/* Mock HTTP callout class to be used by unit tests. */
@isTest
global class ConfirmResponseMock implements HttpCalloutMock {
    /* Implement mock interface method. */
    global HTTPResponse respond(HTTPRequest req) {
        
        /* Create mock response. */
        HttpResponse res = new HttpResponse();
        res.setBody('{"example":"test"}');
        res.setStatusCode(200);
        return res;
    }
}