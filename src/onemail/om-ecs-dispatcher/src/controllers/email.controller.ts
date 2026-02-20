import {
  SendEmailTransactionalBody,
  SendEmailTransactionalRes,
} from '#dtos/email/emailTransactional.dto';
import * as emailService from '#services/email.service';
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

export const sendEmailTransactional = async (
  req: Request<object, object, SendEmailTransactionalBody>,
  res: Response<SendEmailTransactionalRes>,
) => {
  const result = await emailService.sendEmailTransactional(req.body);
  res.status(StatusCodes.OK).json(result);
};
