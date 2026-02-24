import * as HealthController from '#controllers/health.controller';
import { Router } from 'express';

const router = Router();
const prefix = 'health';

router.get('', HealthController.healthCheck);

export default { router, prefix };
