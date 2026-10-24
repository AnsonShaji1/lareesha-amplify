import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const source = resolve('amplify_outputs.json');
if (!existsSync(source)) {
  console.error('amplify_outputs.json not found. Run npx ampx sandbox first.');
  process.exit(1);
}

for (const dest of [
  'apps/storefront/src/environments/amplify_outputs.json',
  'apps/admin/src/environments/amplify_outputs.json',
]) {
  const destPath = resolve(dest);
  mkdirSync(dirname(destPath), { recursive: true });
  copyFileSync(source, destPath);
  console.log('Copied to', dest);
}
