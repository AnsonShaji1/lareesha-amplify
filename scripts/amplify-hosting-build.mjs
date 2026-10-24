/**
 * Amplify Hosting CI entrypoint for both apps in this monorepo.
 *
 * - Storefront app (d2ditwsuelgj89): deploy backend + build storefront
 * - Admin (any other app id): reuse storefront backend outputs + build admin only
 *
 * Artifacts always land in dist-hosting/ so one amplify.yml works for both apps.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const STOREFRONT_APP_ID = 'd2ditwsuelgj89';
const branch = process.env.AWS_BRANCH || 'master';
const appId = process.env.AWS_APP_ID || '';
const isStorefront = appId === STOREFRONT_APP_ID;

const storefrontOut = resolve('apps/storefront/dist/lareesha-luxe/browser');
const adminOut = resolve('apps/admin/dist/admin/browser');
const hostingOut = resolve('dist-hosting');

function run(command, args) {
  console.log(`> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

if (!appId) {
  console.error('AWS_APP_ID is not set. This script is for Amplify Hosting CI.');
  process.exit(1);
}

console.log(`Amplify hosting build for app ${appId} (storefront=${isStorefront})`);

if (isStorefront) {
  run('npx', ['ampx', 'pipeline-deploy', '--branch', branch, '--app-id', appId]);
} else {
  console.log(`Skipping pipeline-deploy; reusing storefront backend ${STOREFRONT_APP_ID}`);
}

run('npx', [
  'ampx',
  'generate',
  'outputs',
  '--branch',
  branch,
  '--app-id',
  STOREFRONT_APP_ID,
]);
run('npm', ['run', 'sync-outputs']);

if (isStorefront) {
  run('npm', ['run', 'build:storefront']);
  if (!existsSync(storefrontOut)) {
    console.error(`Storefront build output missing: ${storefrontOut}`);
    process.exit(1);
  }
  rmSync(hostingOut, { recursive: true, force: true });
  mkdirSync(hostingOut, { recursive: true });
  cpSync(storefrontOut, hostingOut, { recursive: true });
} else {
  run('npm', ['run', 'build:admin']);
  if (!existsSync(adminOut)) {
    console.error(`Admin build output missing: ${adminOut}`);
    process.exit(1);
  }
  rmSync(hostingOut, { recursive: true, force: true });
  mkdirSync(hostingOut, { recursive: true });
  cpSync(adminOut, hostingOut, { recursive: true });
}

console.log(`Hosting artifacts ready at ${hostingOut}`);
