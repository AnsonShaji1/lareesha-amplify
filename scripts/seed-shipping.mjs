/**
 * Create or update the single Shipping settings row (id=default).
 * Requires amplify_outputs.json and AMPLIFY_ADMIN_ID_TOKEN (admin Cognito ID token).
 *
 * Example:
 *   AMPLIFY_ADMIN_ID_TOKEN=... node scripts/seed-shipping.mjs
 *   AMPLIFY_ADMIN_ID_TOKEN=... node scripts/seed-shipping.mjs --free
 *   AMPLIFY_ADMIN_ID_TOKEN=... node scripts/seed-shipping.mjs --fee 60
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const outputs = JSON.parse(readFileSync(resolve('amplify_outputs.json'), 'utf8'));
const endpoint = outputs.data.url;
const token = process.env.AMPLIFY_ADMIN_ID_TOKEN;

if (!token) {
  console.error('Set AMPLIFY_ADMIN_ID_TOKEN to an admin Cognito ID token.');
  process.exit(1);
}

const args = process.argv.slice(2);
const free = args.includes('--free');
const feeIdx = args.indexOf('--fee');
const feeRupees = feeIdx >= 0 ? Number(args[feeIdx + 1]) : 60;
if (!free && (!Number.isFinite(feeRupees) || feeRupees < 0)) {
  console.error('Pass --free or --fee <rupees>');
  process.exit(1);
}

const feePaise = free ? 0 : Math.round(feeRupees * 100);
const now = new Date().toISOString();

async function gql(query, variables) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: token,
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors?.length) {
    throw new Error(JSON.stringify(body.errors, null, 2));
  }
  return body.data;
}

const existing = await gql(
  `query GetShipping($id: String!) {
    getShipping(id: $id) { id isFreeShipping feePaise }
  }`,
  { id: 'default' },
);

const input = {
  id: 'default',
  isFreeShipping: free,
  feePaise,
  updatedAtIso: now,
};

if (existing.getShipping) {
  await gql(
    `mutation UpdateShipping($input: UpdateShippingInput!) {
      updateShipping(input: $input) { id isFreeShipping feePaise }
    }`,
    { input },
  );
  console.log('Updated Shipping default:', input);
} else {
  await gql(
    `mutation CreateShipping($input: CreateShippingInput!) {
      createShipping(input: $input) { id isFreeShipping feePaise }
    }`,
    { input },
  );
  console.log('Created Shipping default:', input);
}
