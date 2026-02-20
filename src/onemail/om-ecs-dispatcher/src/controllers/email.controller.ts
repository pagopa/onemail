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
  console.log('Received request to send transactional email:', req.body);
  const result = await emailService.sendEmailTransactional(req.body);
  res.status(StatusCodes.OK).json(result);
};
