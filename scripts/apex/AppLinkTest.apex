System.debug('=== Testing ProvisioningService asynchronous operation ===');

List<Opportunity> sampleOpps = [
    SELECT Id, Name,
           (SELECT Id FROM OpportunityLineItems LIMIT 1)
    FROM Opportunity
    WHERE Id IN (
        SELECT OpportunityId FROM OpportunityLineItem
    )
    LIMIT 1
];

if (sampleOpps.isEmpty()) {
    System.debug('No opportunities with line items found. Import sample data before running this script.');
} else {
    Opportunity testOpp = sampleOpps[0];
    System.debug('Testing with Opportunity: ' + testOpp.Name + ' (ID: ' + testOpp.Id + ')');
    
    try {
        HerokuAppLink.ProvisioningService service = new HerokuAppLink.ProvisioningService();
        System.debug('ProvisioningService stub created successfully.');
        
        HerokuAppLink.ProvisioningService.provisionServices_Request request = new HerokuAppLink.ProvisioningService.provisionServices_Request();
        request.body = new HerokuAppLink.ProvisioningService_ProvisionServicesRequest();
        request.body.opportunityIds = new List<String>{ testOpp.Id };
        
        System.debug('Provisioning request prepared with ' + request.body.opportunityIds.size() + ' opportunity ID(s).');
        
        ProvisioningCallback callbackHandler = new ProvisioningCallback();
        DateTime callbackTimeout = DateTime.now().addMinutes(10);
        
        System.debug('Invoking provisioning service asynchronously...');
        HerokuAppLink.ProvisioningService.provisionServices_Response response =
            service.provisionServices(request, callbackHandler, callbackTimeout);
        
        if (response != null && response.Code201 != null) {
            System.debug('SUCCESS: provisionServices accepted the job.');
            System.debug('   Job ID: ' + response.Code201.jobId);
            System.debug('   Response Code: ' + response.responseCode);
            System.debug('   Invocation ID: ' + response.invocationId);
        } else {
            System.debug('WARNING: Response received but no Code201 payload returned.');
            System.debug('   Raw response: ' + response);
        }
        
    } catch (HerokuAppLink.ProvisioningService.provisionServices_ResponseException e) {
        System.debug('SERVICE WARNING: provisionServices returned an error response.');
        System.debug('   Response Code: ' + e.responseCode);
        if (String.isNotBlank(e.defaultResponse)) {
            System.debug('   Default Response: ' + e.defaultResponse);
        }
    } catch (Exception e) {
        System.debug('UNEXPECTED EXCEPTION: ' + e.getMessage());
        System.debug('   Type: ' + e.getTypeName());
        System.debug('   Stack: ' + e.getStackTraceString());
    }
}