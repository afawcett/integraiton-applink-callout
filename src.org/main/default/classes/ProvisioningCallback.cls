/**
 * Callback handler for provisioning asynchronous operations
 * Extends the generated AppLink callback interface to handle responses
 */
public class ProvisioningCallback extends HerokuAppLink.ProvisioningService.provisionServices_Callback {
    
    // Static variable to store the notification type ID
    private static Id notificationTypeId;
    
    // Static constructor to query the CustomNotificationType once when class is loaded
    static {
        try {
            CustomNotificationType notificationType = [
                SELECT Id, DeveloperName 
                FROM CustomNotificationType 
                WHERE DeveloperName = 'Service_Provisioning_Update' 
                LIMIT 1
            ];
            notificationTypeId = notificationType.Id;
        } catch (Exception e) {
            // Log error but don't fail - notification will be skipped if type not found
            System.debug('ERROR: Could not find CustomNotificationType Service_Provisioning_Update: ' + e.getMessage());
            notificationTypeId = null;
        }
    }
    
    /**
     * Handles the callback response from the Heroku application
     * Sends a custom notification to the user with the results
     */
    public override void provisioningStatus(List<HerokuAppLink.ProvisioningService.provisionServices_provisioningStatus_Callback> callbacks) {
        // Skip notification if notification type was not found during initialization
        if (notificationTypeId == null) {
            System.debug('WARNING: Skipping notification - CustomNotificationType not configured');
            return;
        }
        
        // Send custom notification to the user
        for (herokuapplink.ProvisioningService.provisionServices_provisioningStatus_Callback callback : callbacks) {
            List<herokuapplink.ProvisioningService_provisioningStatusCallback_IN_body_services> services = callback.response.body.services;
            if (services != null && !services.isEmpty()) {
                for (herokuapplink.ProvisioningService_provisioningStatusCallback_IN_body_services serviceResult : services) {
                    sendServiceNotification(callback.response.body.jobId, serviceResult, callback.response.body.status);
                }
            }

        }
    }

    private void sendServiceNotification(String jobId, herokuapplink.ProvisioningService_provisioningStatusCallback_IN_body_services serviceResult, String overallStatus) {
        Messaging.CustomNotification notification = new Messaging.CustomNotification();
        notification.setTitle('Service Provisioning Update');
        notification.setNotificationTypeId(notificationTypeId);

        String message = serviceResult.message;
        notification.setBody(message);
        notification.setTargetId(UserInfo.getUserId());
        notification.send(new Set<String>{ UserInfo.getUserId() });
    }
}
