'use strict';

/**
 * Handles service provisioning jobs.
 * @param {string} jobId - Unique identifier for the provisioning job.
 * @param {Array<string>} opportunityIds - Array of Opportunity IDs to provision services for.
 * @param {object} client - The Salesforce client from AppLink (from request.salesforce).
 * @param {string} callbackUrl - URL to call back with provisioning results.
 * @param {object} logger - A logger instance.
 */
async function provisionServices (jobId, opportunityIds, client, callbackUrl, logger) {
  // Use opportunityIds in the query
  if (!opportunityIds || !Array.isArray(opportunityIds) || opportunityIds.length === 0) {
    logger.warn(`No opportunityIds provided for Job ID: ${jobId}`);
    return;
  }
  logger.info(`Processing provisioning job ${jobId} for ${opportunityIds.length} opportunity IDs`);

  try {
    // Destructure context from client (as per AppLink SDK structure)
    const { context } = client;
    const org = context.org;
    const dataApi = org.dataApi;
    if (!dataApi) {
      logger.error(`Failed to get valid Salesforce context for provisioning job ${jobId}`);
      return;
    }

    // Query provisioning parameters from custom metadata
    const paramResult = await dataApi.query('SELECT Name__c, Value__c FROM ProvisioningParameter__mdt');
    const provisioningParameters = paramResult.records.reduce((acc, record) => {
      const fields = record.fields || record;
      if (fields.Name__c) acc[fields.Name__c] = fields.Value__c;
      return acc;
    }, {});

    // Query Opportunities by ID
    const opportunityIdList = opportunityIds.map(id => sanitizeSalesforceId(id)).filter(Boolean).map(id => `'${id}'`).join(',');
    const oppQuery = `
      SELECT Id, Name, AccountId, CloseDate, StageName, Amount,
             (SELECT Id, Product2Id, Product2.Name, Quantity, UnitPrice, PricebookEntryId FROM OpportunityLineItems)
      FROM Opportunity
      WHERE Id IN (${opportunityIdList})
    `;
    const opportunities = await queryAll(oppQuery, { context: { org } }, logger);

    logger.info(`Processing ${opportunities.length} Opportunities for provisioning`);
    const services = [];

    let globalServiceCounter = 0;
    for (const oppSObject of opportunities) {
      // Access fields using .fields property
      const opp = oppSObject.fields;
      const oppId = opp.Id || opp.id; // Get the actual ID
      // Access subquery results correctly
      const lineItemsResult = oppSObject.subQueryResults?.OpportunityLineItems;
      if (!lineItemsResult?.records) continue;

      for (const oliSObject of lineItemsResult.records) {
        const oli = oliSObject.fields;
        const lineItemId = oli.Id || oliSObject.id;
        const productLabel = oli.Product2?.fields?.Name || oli.Product2?.Name || oli.Product2Id || 'Service';
        globalServiceCounter += 1;

        const mockResult = await mockProvisionCall({
          jobId,
          opportunityId: oppId,
          lineItemId,
          productLabel,
          counter: globalServiceCounter,
          provisioningParameters
        });

        logger.info({
          jobId,
          opportunityId: oppId,
          lineItemId,
          product: productLabel,
          serviceId: mockResult.serviceId
        }, 'Provisioned mock service for opportunity line item.');

        services.push(mockResult);
      }
    }

    if (services.length === 0) {
      logger.warn(`No services were generated for provisioning job ${jobId}.`);
      return;
    }

    const summary = {
      total: services.length,
      succeeded: services.length,
      failed: 0
    };

    logger.info(`Provisioning job ${jobId} completed. ${summary.succeeded} services provisioned.`);

    if (!callbackUrl) {
      logger.warn(`No callbackUrl provided for provisioning job ${jobId}, skipping callback execution`);
    } else {
      try {
        // Use AppLink SDK's request method for authenticated callback to Salesforce
        // The SDK handles authentication automatically
        const callbackResults = {
          jobId,
          opportunityIds,
          services,
          summary,
          status: 'completed',
          errors: []
        };
        const requestOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(callbackResults)
        };
        await org.request(callbackUrl, requestOptions);
        logger.info(`Provisioning callback executed successfully for Job ID: ${jobId}. Services returned: ${services.length}`);
      } catch (callbackError) {
        logger.error({ err: callbackError, jobId }, `Failed to execute provisioning callback for Job ID: ${jobId}`);
      }
    }

  } catch (error) {
    logger.error({ err: error }, `Error executing provisioning batch for Job ID: ${jobId}`);
  }
}

/**
 * Helper function to fetch all records for a SOQL query, handling pagination.
 * @param {string} soql - The SOQL query string.
 * @param {object} sfContext - The initialized Salesforce context (ContextImpl instance or named connection).
 * @param {object} logger - A logger instance.
 * @returns {Promise<Array>} - A promise that resolves with an array of all records.
 */
async function queryAll (soql, sfContext, logger) {
  let allRecords = [];
  try {
    // Access dataApi via context.org.dataApi (as per AppLink SDK structure)
    const dataApi = sfContext.context?.org?.dataApi;
    
    if (!dataApi) {
      throw new Error('No dataApi available in sfContext');
    }
    
    let result = await dataApi.query(soql);
    allRecords = allRecords.concat(result.records);
    while (!result.done && result.nextRecordsUrl) {
      result = await dataApi.queryMore(result); // Use result object directly
      allRecords = allRecords.concat(result.records);
    }
  } catch (error) {
    logger.error({ err: error, soql }, 'Error during queryAll execution');
    throw error; // Re-throw the error to be caught by the caller
  }
  return allRecords;
}

async function mockProvisionCall ({ jobId, opportunityId, lineItemId, productLabel, counter, provisioningParameters }) {
  await new Promise(resolve => setTimeout(resolve, 10_000));
  const timestamp = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC',
    hour12: true
  }).format(new Date());
  const tier = provisioningParameters?.DefaultTier || 'Standard';
  const region = provisioningParameters?.Region || 'US';
  const compliance = provisioningParameters?.Compliance || 'General';

  return {
    serviceId: `svc-${jobId}-${counter}`,
    opportunityId,
    lineItemId,
    productReference: productLabel,
    status: 'Provisioned',
    message: `Provisioned service for product ${productLabel} at ${timestamp} UTC (${tier}, ${region}, Compliance: ${compliance})`
  };
}

export {
  provisionServices
};

/**
 * Ensures the provided Salesforce Id is in the correct format to avoid SOQL injection.
 * Salesforce Ids are 15 or 18 character alphanumeric strings.
 * @param {string} id - The Salesforce Id to sanitize.
 * @returns {string|null} - Returns the sanitized Id or null if invalid.
 */
function sanitizeSalesforceId (id) {
  if (typeof id !== 'string') {
    return null;
  }
  const trimmed = id.trim();
  return /^[a-zA-Z0-9]{15,18}$/.test(trimmed) ? trimmed : null;
}
