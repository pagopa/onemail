import { configDotenv } from 'dotenv';
import { fileURLToPath, URL } from 'node:url';
import '#config/zodExtend';

import { registerVitestBaseHooks } from '../../../viTestBase.shared.js';

configDotenv({
  path: fileURLToPath(new URL('../../.env.test', import.meta.url)),
  quiet: true,
});

registerVitestBaseHooks();
