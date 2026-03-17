import * as HealthController from '#controllers/health.controller';
import {
  HealthResponseSchema,
  SimpleHealthResponseSchema,
} from '#dtos/health/health.dto';
import { registerOpenApiRoute } from '#utils/openapi';
import { Router } from 'express';
import { StatusCodes } from 'http-status-codes';

const router = Router();
const prefix = 'health';
const tag = 'Health';

router.get('/ready', HealthController.readinessCheck);
registerOpenApiRoute({
  method: 'get',
  path: `/${prefix}/ready`,
  summary: 'Perform readiness check of the service',
  tags: [tag],
  responses: {
    [StatusCodes.OK]: {
      schema: HealthResponseSchema,
      description: 'Service is ready',
    },
  },
});

router.get('', HealthController.livenessCheck);
registerOpenApiRoute({
  method: 'get',
  path: `/${prefix}`,
  summary: 'Perform liveness check of the service',
  tags: [tag],
  responses: {
    [StatusCodes.OK]: {
      schema: SimpleHealthResponseSchema,
      description: 'Service is alive',
    },
  },
});

export default { router, prefix };
