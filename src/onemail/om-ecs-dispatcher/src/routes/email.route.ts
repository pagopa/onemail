import env from '#config/env';
import * as EmailController from '#controllers/email.controller';
import { TenantNameHeaderSchema } from '#dtos/email/common.dto';
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
import {
  EmailStatusQueryParamsSchema,
  EmailStatusResponseSchema,
} from '#dtos/email/emailStatus.dto';
import {
  SanitizeHtmlResponseSchema,
  SanitizeHtmlSchema,
} from '#dtos/email/validateHtml.dto';
import { validate } from '#middlewares/validateApiInput.middleware';
import { APP_ENV_VALUES, versionRoutePath } from '#utils/constants';
import { registerOpenApiRoute } from '#utils/openapi';
import { Router } from 'express';
import { StatusCodes } from 'http-status-codes';

const router = Router();
const prefix = 'emails';
const tag = 'Emails';

router.get(
  '/statuses',
  validate({
    query: EmailStatusQueryParamsSchema,
    headers: TenantNameHeaderSchema,
  }),
  EmailController.getEmailStatus,
);
registerOpenApiRoute({
  method: 'get',
  path: `${versionRoutePath.v1}/${prefix}/statuses`,
  summary: 'Get email status history',
  tags: [tag],
  isAuthenticated: true,
  queryParams: EmailStatusQueryParamsSchema,
  headers: TenantNameHeaderSchema,
  responses: {
    [StatusCodes.OK]: {
      schema: EmailStatusResponseSchema,
      description: 'Email status history retrieved successfully',
    },
  },
});

router.post(
  '/send/high',
  validate({
    body: EmailHighPriorityBodySchema,
    query: EmailHighPriorityQueryParamsSchema,
    headers: TenantNameHeaderSchema,
  }),
  EmailController.sendEmailTransactional,
);
registerOpenApiRoute({
  method: 'post',
  path: `${versionRoutePath.v1}/${prefix}/send/high`,
  summary: 'Send high priority single email',
  tags: [tag],
  isAuthenticated: true,
  queryParams: EmailHighPriorityQueryParamsSchema,
  requestBody: EmailHighPriorityBodySchema,
  headers: TenantNameHeaderSchema,
  responses: {
    [StatusCodes.ACCEPTED]: {
      schema: EmailHighPriorityResponseSchema,
      description: 'Email accepted for processing',
    },
  },
});

router.post(
  '/send/low',
  validate({
    body: EmailLowPriorityBodySchema,
    query: EmailLowPriorityQueryParamsSchema,
    headers: TenantNameHeaderSchema,
  }),
  EmailController.sendEmailLowPriority,
);
registerOpenApiRoute({
  method: 'post',
  path: `${versionRoutePath.v1}/${prefix}/send/low`,
  summary: 'Send low priority email with single or multiple recipients',
  tags: [tag],
  isAuthenticated: true,
  queryParams: EmailLowPriorityQueryParamsSchema,
  requestBody: EmailLowPriorityBodySchema,
  headers: TenantNameHeaderSchema,
  responses: {
    [StatusCodes.ACCEPTED]: {
      schema: EmailLowPriorityResponseSchema,
      description: 'Email accepted for processing',
    },
  },
});

if (env.server.environment !== APP_ENV_VALUES.production) {
  router.post(
    '/sanitize-html',
    validate({
      body: SanitizeHtmlSchema,
    }),
    EmailController.sanitizeHtmlContent,
  );
  registerOpenApiRoute({
    method: 'post',
    path: `${versionRoutePath.v1}/${prefix}/sanitize-html`,
    summary:
      'Test HTML content sanitization of the email, only available in non-production environments',
    tags: [tag],
    requestBody: SanitizeHtmlSchema,
    responses: {
      [StatusCodes.OK]: {
        schema: SanitizeHtmlResponseSchema,
        description: 'Email sanitized successfully',
      },
    },
  });
}

export default { router, prefix };
