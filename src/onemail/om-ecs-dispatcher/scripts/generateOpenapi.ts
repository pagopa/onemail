import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { generateSwaggerDocs } from '../src/config/apidocs.js';

const CONFIG = {
  SERVER_URL: '${server_url}',
  ROUTES_ENTRY: 'src/routes/index.ts',
  ZOD_EXTEND: 'src/config/zodExtend.ts',
  OUTPUT_DIR: 'apidoc',
  OUTPUT_FILE_NAME: 'openapi-docs.json',
};

async function generate() {
  const root = process.cwd();
  const outputPath = resolve(root, CONFIG.OUTPUT_DIR, CONFIG.OUTPUT_FILE_NAME);

  try {
    console.log('Generating OpenAPI documentation...');

    // Import the entry points to trigger OpenApi route registration and ZodOpenAPI extensions
    await import(resolve(root, CONFIG.ZOD_EXTEND));
    await import(resolve(root, CONFIG.ROUTES_ENTRY));

    const docs = generateSwaggerDocs();
    docs.servers = [{ url: CONFIG.SERVER_URL }];

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify(docs, null, 2) + '\n', 'utf-8');

    console.log(
      `✅ OpenAPI documentation successfully generated at: ${outputPath}`,
    );
  } catch (error) {
    console.error('❌ Error generating OpenAPI documentation:', error);
    process.exit(1);
  }
}

generate();
