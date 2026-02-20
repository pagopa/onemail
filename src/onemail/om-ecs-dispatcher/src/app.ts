import { errorHandler } from '#middlewares/errorHandler.middleware';
import express from 'express';

import env from './config/env.js';
import routes from './routes/index.js';

const app = express();
const PORT = env.server.PORT;

// api response type middlewares
app.use(express.json());

// api routes
app.use('/', routes);

// global error middleware
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}...`);
});
