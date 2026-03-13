import env from '#config/env';
import { APP_ENV_VALUES, versionRoutePath } from '#utils/constants';
import express from 'express';

import emailRoute from './email.route.js';
import healthRoute from './health.route.js';

const expressRouter = express.Router();

// Generic routes (without version prefix)
const genericRoutes = [
  {
    prefix: healthRoute.prefix,
    router: healthRoute.router,
  },
];

genericRoutes.forEach((route) => {
  expressRouter.use(`/${route.prefix}`, route.router);
});

// Versioned routes (v1)
const routesV1 = [
  {
    prefix: emailRoute.prefix,
    router: emailRoute.router,
  },
];

routesV1.forEach((route) => {
  expressRouter.use(`${versionRoutePath.v1}/${route.prefix}`, route.router);
});

// OpenAPI docs route
// ! The OpenAPI route needs to be imported and registered at the end to ensure that all routes and components are registered before generating the documentation
import openApiRoute from './openapi.route.js';
if (env.server.environment === APP_ENV_VALUES.local) {
  expressRouter.use(`/${openApiRoute.prefix}`, openApiRoute.router);
}

export default expressRouter;
