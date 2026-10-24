import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const source = resolve('amplify_outputs.json');
if (!existsSync(source)) {
  console.error('amplify_outputs.json not found. Run npx ampx sandbox first.');
  process.exit(1);
}

for (const dest of [
  'apps/storefront/src/environments/amplify_outputs.json',
  'apps/admin/src/environments/amplify_outputs.json',
]) {
  copyFileSync(source, resolve(dest));
  console.log('Copied to', dest);
}
