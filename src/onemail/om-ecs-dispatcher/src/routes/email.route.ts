import * as EmailController from '#controllers/email.controller';
import {
  EmailHighPriorityBodySchema,
  EmailHighPriorityQueryParamsSchema,
  EmailHighPriorityResponseSchema,
} from '#dtos/email/emailHighPriority.dto';
import {
  EmailLowPriorityBodySchema,
  EmailLowPriorityQueryParamsSchema,
  EmailLowPriorityResponseSchema,
} from '#dtos/email/emailLowPriority.dto';
import { validate } from '#middlewares/validateApiInput.middleware';
import { versionRoutePath } from '#utils/constants';
import { registerOpenApiRoute } from '#utils/openapi';
import { Router } from 'express';
import { StatusCodes } from 'http-status-codes';

const router = Router();
const prefix = 'emails';
const tag = 'Emails';

router.post(
  '/send/high',
  validate({
    body: EmailHighPriorityBodySchema,
    query: EmailHighPriorityQueryParamsSchema,
  }),
  EmailController.sendEmailTransactional,
);
registerOpenApiRoute({
  method: 'post',
  path: `${versionRoutePath.v1}/${prefix}/send/high`,
  summary: 'Send high priority single email',
  tags: [tag],
  queryParams: EmailHighPriorityQueryParamsSchema,
  requestBody: EmailHighPriorityBodySchema,
  responses: {
    [StatusCodes.ACCEPTED]: {
      schema: EmailHighPriorityResponseSchema,
      description: 'Email accepted for processing',
    },
  },
});

// router.post('/send/low', EmailController.sendEmail);
registerOpenApiRoute({
  method: 'post',
  path: `${versionRoutePath.v1}/${prefix}/send/low`,
  summary: 'Send low priority email with single or multiple recipients',
  tags: [tag],
  queryParams: EmailLowPriorityQueryParamsSchema,
  requestBody: EmailLowPriorityBodySchema,
  responses: {
    [StatusCodes.ACCEPTED]: {
      schema: EmailLowPriorityResponseSchema,
      description: 'Email accepted for processing',
    },
  },
});

export default { router, prefix };
