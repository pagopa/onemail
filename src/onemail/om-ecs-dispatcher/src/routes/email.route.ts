import * as EmailController from '#controllers/email.controller';
import {
  EmailHighPriorityBodySchema,
  EmailHighPriorityQueryParamsSchema,
} from '#dtos/email/emailHighPriority.dto';
import { validate } from '#middlewares/validateApiInput.middleware';
import { Router } from 'express';

const router = Router();
const prefix = 'emails';

router.post(
  '/send/high',
  validate({
    body: EmailHighPriorityBodySchema,
    query: EmailHighPriorityQueryParamsSchema,
  }),
  EmailController.sendEmailTransactional,
);

// router.post('/send/low', EmailController.sendEmail);

export default { router, prefix };
