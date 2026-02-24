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
const routesV1Path = '/v1';
const routesV1 = [
  {
    prefix: healthRoute.prefix,
    router: healthRoute.router,
  },
  {
    prefix: emailRoute.prefix,
    router: emailRoute.router,
  },
];

routesV1.forEach((route) => {
  expressRouter.use(`${routesV1Path}/${route.prefix}`, route.router);
});

export default expressRouter;
