import { configDotenv } from 'dotenv';
import { fileURLToPath, URL } from 'node:url';
import '#config/zodExtend';

configDotenv({
  path: fileURLToPath(new URL('../../.env.test', import.meta.url)),
  quiet: true,
});
