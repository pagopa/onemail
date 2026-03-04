import {
  EmailHighPriorityBodyDTO,
  EmailHighPriorityQueryParams,
  EmailHighPriorityResponseDTO,
} from '#dtos/email/emailHighPriority.dto';
import {
  EmailLowPriorityBodyDTO,
  EmailLowPriorityQueryParams,
  EmailLowPriorityResponseDTO,
} from '#dtos/email/emailLowPriority.dto';
import {
  SanitizeHtmlDTO,
  SanitizeHtmlResponseDTO,
} from '#dtos/email/validateHtml.dto';
import * as emailService from '#services/email.service';
import { AsStringQuery } from '#types/RequestType';
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
  const result = await emailService.sendEmailTransactional(req.body, dryRun);
  res.status(StatusCodes.OK).json(result);
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
  const result = await emailService.sendEmailLowPriority(req.body, dryRun);
  res.status(StatusCodes.OK).json(result);
};

export const sanitizeHtmlContent = async (
  req: Request<unknown, unknown, SanitizeHtmlDTO>,
  res: Response<SanitizeHtmlResponseDTO>,
) => {
  res.status(StatusCodes.OK).json({ sanitizedHtml: req.body.htmlContent });
};
