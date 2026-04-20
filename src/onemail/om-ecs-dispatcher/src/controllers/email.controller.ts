import {
  EmailHighPriorityBodyDTO,
  EmailHighPriorityQueryParams,
  EmailHighPriorityResponseDTO,
} from '#dtos/email/emailHighPriority.dto';
import {
  EmailLowPriorityBodyDTO,
  EmailLowPriorityQueryParams,
  EmailLowPriorityResponseDTO,
  SendingInfoDTO,
} from '#dtos/email/emailLowPriority.dto';
import {
  EmailStatusQueryParamsDTO,
  EmailStatusResponseDTO,
} from '#dtos/email/emailStatus.dto';
import {
  SanitizeHtmlDTO,
  SanitizeHtmlResponseDTO,
} from '#dtos/email/validateHtml.dto';
import { ERROR_CODES } from '#dtos/error.dto';
import { ApiError } from '#errors/api.error';
import * as emailService from '#services/email.service';
import { AsStringQuery } from '#types/request.type';
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export const sendEmailTransactional = async (
  req: Request<
    unknown,
    unknown,
    EmailHighPriorityBodyDTO,
    AsStringQuery<EmailHighPriorityQueryParams>
  >,
  res: Response<EmailHighPriorityResponseDTO>,
) => {
  const { dryRun } = req.query as unknown as EmailHighPriorityQueryParams;
  const tenantId = req.headers['x-tenant-id'] as string;

  const result = await emailService.sendEmailTransactional(
    req.body,
    dryRun,
    tenantId,
  );
  res.status(StatusCodes.ACCEPTED).json(result);
};

export const sendEmailLowPriority = async (
  req: Request<
    unknown,
    unknown,
    EmailLowPriorityBodyDTO,
    AsStringQuery<EmailLowPriorityQueryParams>
  >,
  res: Response<EmailLowPriorityResponseDTO>,
) => {
  const { dryRun } = req.query as unknown as EmailLowPriorityQueryParams;
  const tenantId = req.headers['x-tenant-id'] as string;

  if (!dryRun) {
    validateNoDuplicateRecipients(req.body.sendingInfo);
  }
  const result = await emailService.sendEmailLowPriority(
    req.body,
    dryRun,
    tenantId,
  );
  res.status(StatusCodes.ACCEPTED).json(result);
};

export const sanitizeHtmlContent = async (
  req: Request<unknown, unknown, SanitizeHtmlDTO>,
  res: Response<SanitizeHtmlResponseDTO>,
) => {
  res.status(StatusCodes.OK).json({ sanitizedHtml: req.body.htmlContent });
};

export const getEmailStatus = async (
  req: Request<
    unknown,
    unknown,
    unknown,
    AsStringQuery<EmailStatusQueryParamsDTO>
  >,
  res: Response<EmailStatusResponseDTO>,
) => {
  const { requestId } = req.query as unknown as EmailStatusQueryParamsDTO;
  const tenantId = req.headers['x-tenant-id'] as string;

  const result = await emailService.getEmailStatus(requestId, tenantId);
  res.status(StatusCodes.OK).json(result);
};

function validateNoDuplicateRecipients(sendingInfo: SendingInfoDTO[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const item of sendingInfo) {
    const email = item.to.email.trim().toLowerCase();
    if (seen.has(email)) duplicates.add(email);
    seen.add(email);
  }
  if (duplicates.size > 0) {
    throw new ApiError(
      `Duplicate recipient addresses are not allowed: ${[...duplicates].join(', ')}`,
      StatusCodes.BAD_REQUEST,
      ERROR_CODES.EMAIL_DUPLICATE_ERROR,
    );
  }
}
