import * as HealthController from '#controllers/health.controller';
import { HealthResponseSchema } from '#dtos/health/health.dto';
import { registerOpenApiRoute } from '#utils/openapi';
import { Router } from 'express';
import { StatusCodes } from 'http-status-codes';

const router = Router();
const prefix = 'health';
const tag = 'Health';

router.get('', HealthController.healthCheck);
registerOpenApiRoute({
  method: 'get',
  path: `/${prefix}`,
  summary: 'Perform health check of the service',
  tags: [tag],
  responses: {
    [StatusCodes.OK]: {
      schema: HealthResponseSchema,
      description: 'Service is healthy',
    },
  },
});

export default { router, prefix };
