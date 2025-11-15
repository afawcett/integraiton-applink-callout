/**
 * @description Controller extension for the Provision Services Visualforce page
 * Provides functionality to provision services for selected opportunities using the Heroku service
 */
public with sharing class ProvisionServicesController {
    
    private final ApexPages.StandardSetController stdController;
    
    /**
     * @description Constructor
     * @param stdController The standard controller for the page
     */
    public ProvisionServicesController(ApexPages.StandardSetController stdController) {
        this.stdController = stdController;
    }
    
    /**
     * @description Provisions services for all selected opportunities using the Heroku service
     * @return PageReference to refresh the page and show results
     */
    public PageReference provisionServicesForSelected() {
        try {
            // Get the selected opportunities
            List<Opportunity> selectedOpps = (List<Opportunity>) this.stdController.getSelected();
            
            if (selectedOpps.isEmpty()) {
                ApexPages.addMessage(new ApexPages.Message(
                    ApexPages.Severity.WARNING, 
                    'No opportunities selected. Please select at least one opportunity.'
                ));
                return null;
            }
            
            // Extract opportunity IDs
            List<String> opportunityIds = new List<String>();
            for (Opportunity opp : selectedOpps) {
                opportunityIds.add(opp.Id);
            }
            
            // Call the Heroku service with callback
            try {
                HerokuAppLink.ProvisioningService service = new HerokuAppLink.ProvisioningService();
                HerokuAppLink.ProvisioningService.provisionServices_Request request = new HerokuAppLink.ProvisioningService.provisionServices_Request();
                request.body = new HerokuAppLink.ProvisioningService_ProvisionServicesRequest();
                request.body.opportunityIds = opportunityIds;
                
                // Create callback handler for notifications
                ProvisioningCallback callbackHandler = new ProvisioningCallback();
                
                // Set callback timeout to 10 minutes from now
                DateTime callbackTimeout = DateTime.now().addMinutes(10);
                
                // Call the service with callback
                HerokuAppLink.ProvisioningService.provisionServices_Response response = service.provisionServices(request, callbackHandler, callbackTimeout);
                
                if (response != null && response.Code201 != null) {
                    // Show success message
                    ApexPages.addMessage(new ApexPages.Message(
                        ApexPages.Severity.CONFIRM, 
                        String.format('Successfully submitted provisioning job for {0} opportunities. Job ID: {1}. You will receive notifications as services are provisioned.', 
                                    new List<String>{ String.valueOf(opportunityIds.size()), response.Code201.jobId })
                    ));
                } else {
                    throw new AuraHandledException('No response received from provisioning service');
                }
            } catch (HerokuAppLink.ProvisioningService.provisionServices_ResponseException e) {
                // Handle specific Heroku service errors
                String errorMessage = 'Service error: ';
                if (String.isNotBlank(e.defaultResponse)) {
                    errorMessage += e.defaultResponse;
                } else {
                    errorMessage += 'Unknown error (Response code: ' + e.responseCode + ')';
                }
                throw new AuraHandledException(errorMessage);
            }
            
        } catch (Exception e) {
            // Show error message
            ApexPages.addMessage(new ApexPages.Message(
                ApexPages.Severity.ERROR, 
                'Error provisioning services: ' + e.getMessage()
            ));
        }
        
        return null; // Stay on the same page
    }
    

}
