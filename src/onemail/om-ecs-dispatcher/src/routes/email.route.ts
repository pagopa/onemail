import * as EmailController from '#controllers/email.controller';
import { sendEmailTransactionalBodySchema } from '#dtos/email/emailTransactional.dto';
import { validate } from '#middlewares/validateApiInput.middleware';
import { Router } from 'express';

const router = Router();
const prefix = 'emails';

router.post(
  '/send/transactional',
  validate({
    body: sendEmailTransactionalBodySchema,
  }),
  EmailController.sendEmailTransactional,
);

// router.post('/send', EmailController.sendEmail);

export default { router, prefix };
