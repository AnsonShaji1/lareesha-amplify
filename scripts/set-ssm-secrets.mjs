/**
 * Write /lareesha/* values to AWS Systems Manager Parameter Store,
 * and Google OAuth values to Amplify sandbox secrets.
 *
 *   1. Fill scripts/ssm.local.env
 *   2. npm run ssm:secrets
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dryRun = process.argv.includes('--dry-run');
const corsOnly = process.argv.includes('--cors-only');
const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-south-1';
const prefix = '/lareesha';
const filePath = resolve('scripts/ssm.local.env');
const ampxEntry = resolve('node_modules/@aws-amplify/backend-cli/lib/ampx.js');
const sandboxSecrets = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
const corsOrigins = [
  'http://localhost:4200',
  'http://localhost:4201',
  'http://127.0.0.1:4200',
  'http://127.0.0.1:4201',
];
const corsConfig = {
  CORSRules: [
    {
      AllowedOrigins: corsOrigins,
      AllowedMethods: ['GET', 'PUT', 'HEAD'],
      AllowedHeaders: ['*'],
      ExposeHeaders: ['ETag', 'Content-Type'],
      MaxAgeSeconds: 3600,
    },
  ],
};

function parseEnvFile(path) {
  const values = {};
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const cut = line.indexOf('=');
    if (cut < 1) continue;
    const key = line.slice(0, cut).trim();
    let value = line.slice(cut + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

if (!existsSync(filePath)) {
  console.error('Create scripts/ssm.local.env from scripts/ssm.local.env.example and fill in the secrets.');
  process.exit(1);
}

const env = parseEnvFile(filePath);

const parameters = [
  { name: 'r2-account-id', type: 'SecureString', key: 'R2_ACCOUNT_ID', required: true },
  { name: 'r2-access-key-id', type: 'SecureString', key: 'R2_ACCESS_KEY_ID', required: true },
  { name: 'r2-secret-access-key', type: 'SecureString', key: 'R2_SECRET_ACCESS_KEY', required: true },
  { name: 'r2-bucket-name', type: 'String', key: 'R2_BUCKET_NAME', required: true },
  { name: 'r2-public-url', type: 'String', key: 'R2_PUBLIC_URL', required: true },
  { name: 'razorpay-key-id', type: 'SecureString', key: 'RAZORPAY_KEY_ID', required: false },
  { name: 'razorpay-key-secret', type: 'SecureString', key: 'RAZORPAY_KEY_SECRET', required: false },
  { name: 'razorpay-webhook-secret', type: 'SecureString', key: 'RAZORPAY_WEBHOOK_SECRET', required: false },
].map((item) => ({ ...item, value: (env[item.key] || '').trim() }));

const missing = parameters.filter((item) => item.required && !item.value);
if (missing.length) {
  console.error('Missing required values in scripts/ssm.local.env:');
  for (const item of missing) console.error(`  ${item.key}`);
  process.exit(1);
}

function r2CliEnv() {
  const env = { ...process.env };
  delete env.AWS_SESSION_TOKEN;
  delete env.AWS_PROFILE;
  delete env.AWS_DEFAULT_PROFILE;
  env.AWS_ACCESS_KEY_ID = (parameters.find((item) => item.key === 'R2_ACCESS_KEY_ID') || {}).value;
  env.AWS_SECRET_ACCESS_KEY = (parameters.find((item) => item.key === 'R2_SECRET_ACCESS_KEY') || {}).value;
  env.AWS_DEFAULT_REGION = 'us-east-1';
  env.AWS_REGION = 'us-east-1';
  return env;
}

function applyR2Cors() {
  const accountId = (parameters.find((item) => item.key === 'R2_ACCOUNT_ID') || {}).value;
  const bucket = (parameters.find((item) => item.key === 'R2_BUCKET_NAME') || {}).value;
  if (!accountId || !bucket) {
    console.error('R2 account or bucket is missing; skipped CORS.');
    return false;
  }
  if (dryRun) {
    console.log(`[dry-run] R2 CORS on bucket ${bucket} for ${corsOrigins.join(', ')}`);
    return true;
  }
  const result = spawnSync(
    'aws',
    [
      's3api',
      'put-bucket-cors',
      '--bucket',
      bucket,
      '--endpoint-url',
      `https://${accountId}.r2.cloudflarestorage.com`,
      '--cors-configuration',
      JSON.stringify(corsConfig),
      '--region',
      'us-east-1',
    ],
    { encoding: 'utf8', env: r2CliEnv(), stdio: ['ignore', 'pipe', 'pipe'] },
  );
  if (result.status !== 0) {
    console.error('Failed to set R2 CORS');
    console.error(result.stderr || result.stdout);
    return false;
  }
  console.log(`Set R2 CORS on ${bucket} for local admin/storefront.`);
  return true;
}

if (!corsOnly) {
  console.log(`Writing Parameter Store values in ${region}`);
}

let ok = true;
if (!corsOnly) for (const item of parameters) {
  const name = `${prefix}/${item.name}`;
  if (!item.value) {
    console.log(`Skipped ${name}`);
    continue;
  }
  if (dryRun) {
    console.log(`[dry-run] ${name} (${item.type})`);
    continue;
  }
  const result = spawnSync(
    'aws',
    [
      'ssm',
      'put-parameter',
      '--name',
      name,
      '--type',
      item.type,
      '--value',
      item.value,
      '--overwrite',
      '--region',
      region,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  if (result.status !== 0) {
    console.error(`Failed ${name}`);
    console.error(result.stderr || result.stdout);
    ok = false;
  } else {
    console.log(`Wrote ${name}`);
  }
}

function setSandboxSecret(name) {
  const value = (env[name] || '').trim();
  if (!value) {
    console.log(`Skipped sandbox secret ${name}`);
    return true;
  }
  if (dryRun) {
    console.log(`[dry-run] sandbox secret ${name}`);
    return true;
  }
  const result = spawnSync(process.execPath, [ampxEntry, 'sandbox', 'secret', 'set', name], {
    encoding: 'utf8',
    input: value,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    console.error(`Failed sandbox secret ${name}`);
    console.error((result.stderr || result.stdout || '').replaceAll(value, '[redacted]'));
    return false;
  }
  const notice = (result.stdout || '').trim();
  console.log(notice || `Set sandbox secret ${name}`);
  return true;
}

if (!corsOnly) {
  for (const name of sandboxSecrets) {
    if (!setSandboxSecret(name)) ok = false;
  }
}

if (!ok) process.exit(1);
if (!applyR2Cors()) process.exit(1);
if (dryRun) console.log('Dry run complete.');
else if (corsOnly) console.log('R2 CORS is updated. Retry the admin image upload.');
else console.log('Parameter Store and R2 CORS are updated. Retry the admin image upload.');
