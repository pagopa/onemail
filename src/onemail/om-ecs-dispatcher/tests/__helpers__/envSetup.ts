import { configDotenv } from 'dotenv';
import { fileURLToPath, URL } from 'node:url';
import '#config/zodExtend';

configDotenv({
  path: fileURLToPath(new URL('../../.env.test', import.meta.url)),
  quiet: true,
});

process.env.EXCLUDED_DOMAINS =
  'pec.*,cert.*,legalmail.it,postecert.it,arubapec.it,mypec.eu,gigapec.it,postecertifica.it,sicurezzapostale.it,namirialpec.it,spidmail.it,test.*';
