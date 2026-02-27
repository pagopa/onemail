import { generateSwaggerDocs } from '#config/apidocs';
import { Router } from 'express';
import { Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';

const prefix = 'api-docs';
const router = Router();

const swaggerDocs = generateSwaggerDocs();

// json open api documentation
router.get('/', (_req: Request, res: Response) => {
  res.json(swaggerDocs);
});

// swagger ui
router.use('/ui', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

export default { router, prefix };
