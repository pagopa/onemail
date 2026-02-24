import {
  EmailHighPriorityBodyDTO,
  EmailHighPriorityQueryParams,
  EmailHighPriorityResponseDTO,
} from '#dtos/email/emailHighPriority.dto';
import * as emailService from '#services/email.service';
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export const sendEmailTransactional = async (
  req: Request<
    unknown,
    unknown,
    EmailHighPriorityBodyDTO,
    EmailHighPriorityQueryParams
  >,
  res: Response<EmailHighPriorityResponseDTO>,
) => {
  const dryRun = req.query.dryRun === 'true';
  const result = await emailService.sendEmailTransactional(req.body, dryRun);
  res.status(StatusCodes.OK).json(result);
};
