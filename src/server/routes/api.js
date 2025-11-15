import crypto from 'node:crypto';
import { provisionServices } from '../services/provisionServices.js';

// Define schemas for request validation and Swagger generation
const provisionServicesSchema = {
  tags: ['Provisioning'],
  summary: 'Submit Provisioning Job',
  description: 'Provision services for a list of Opportunity IDs based on their line items.',
  operationId: 'provisionServices',
  'x-sfdc': {
    heroku: {
      authorization: {
        connectedApp: 'ProvisioningServiceConnectedApp',
        permissionSet: 'ProvisioningServicePermissions'
      }
    }
  },
  body: {
    $ref: 'ProvisionServicesRequest#'
  },
  response: {
    201: {
      description: 'Provisioning request accepted',
      content: {
        'application/json': {
          schema: {
            $ref: 'ProvisionServicesResponse#'
          }
        }
      }
    }
  },
  'x-callbacks': {
    provisioningStatus: {
      '{$request.body#/callbackUrl}': {
        post: {
          description: 'Callback with provisioning status per requested service',
          operationId: 'provisioningStatusCallback',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    jobId: { type: 'string' },
                    opportunityIds: {
                      type: 'array',
                      items: { type: 'string' }
                    },
                    services: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          serviceId: { type: 'string' },
                          opportunityId: { type: 'string' },
                          lineItemId: { type: 'string' },
                          productReference: { type: 'string' },
                          status: { type: 'string' },
                          message: { type: 'string' }
                        }
                      }
                    },
                    summary: {
                      type: 'object',
                      properties: {
                        total: { type: 'integer' },
                        succeeded: { type: 'integer' },
                        failed: { type: 'integer' }
                      }
                    },
                    status: { type: 'string' },
                    errors: {
                      type: 'array',
                      items: { type: 'string' }
                    }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Provisioning callback received successfully'
            }
          }
        }
      }
    }
  }
};

const ProvisionServicesRequestSchema = {
  $id: 'ProvisionServicesRequest',
  type: 'object',
  required: ['opportunityIds'],
  description: 'Request to provision services for multiple opportunities',
  properties: {
    opportunityIds: {
      type: 'array',
      items: {
        type: 'string'
      },
      description: 'Array of opportunity IDs to provision services for'
    },
    callbackUrl: {
      type: 'string',
      description: 'Callback URL for asynchronous response'
    }
  }
};

const ProvisionServicesResponseSchema = {
  $id: 'ProvisionServicesResponse',
  type: 'object',
  required: ['jobId'],
  description: 'Response for service provisioning - returns job ID for async operation',
  properties: {
    jobId: {
      type: 'string',
      description: 'Unique identifier for tracking the provisioning job'
    }
  }
};

/**
 * API Routes plugin for handling service provisioning operations.
 * @param {import('fastify').FastifyInstance} fastify
 * @param {object} opts Plugin options
 */
export default async function apiRoutes (fastify, opts) {

  // Register schema components
  fastify.addSchema(ProvisionServicesRequestSchema);
  fastify.addSchema(ProvisionServicesResponseSchema);

  fastify.post('/provisionServices', {
    schema: provisionServicesSchema,
    handler: async (request, reply) => {
      const { opportunityIds, callbackUrl } = request.body;
      const jobId = crypto.randomUUID();

      // Check for Salesforce context from middleware
      const client = request.salesforce;
      if (!client || !client.context || !client.context.org || !client.context.org.dataApi) {
        request.log.error('Salesforce context not available in request');
        return reply.code(401).send({ error: 'Salesforce context required. Ensure x-client-context header is present.' });
      }

      // Respond immediately with 201 for async operation
      reply.code(201).send({ jobId });

      // Process provisioning asynchronously
      setImmediate(async () => {
        try {
          await provisionServices(
            jobId,
            opportunityIds,
            client,
            callbackUrl,
            request.log
          );
        } catch (error) {
          request.log.error({ err: error, jobId }, 'Error processing provisioning job');
        }
      });
    }
  });

  fastify.log.info('API routes registered for provisioning operations.');
}
