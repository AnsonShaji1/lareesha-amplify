/**
 * Seed shipping zones after `npx ampx sandbox` has written amplify_outputs.json.
 * Uses the AppSync API with an admin user token passed as AMPLIFY_ADMIN_ID_TOKEN.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const outputs = JSON.parse(readFileSync(resolve('amplify_outputs.json'), 'utf8'));
const endpoint = outputs.data.url;
const apiKey = outputs.data.api_key;
const token = process.env.AMPLIFY_ADMIN_ID_TOKEN;

if (!token) {
  console.error('Set AMPLIFY_ADMIN_ID_TOKEN to an admin Cognito ID token.');
  process.exit(1);
}

const now = new Date().toISOString();

const zones = [
  {
    name: 'Local Ernakulam',
    code: 'local-ernakulam',
    baseFeePaise: 6000,
    freeShippingMinOrderPaise: 250000,
    priority: 10,
    isActive: true,
    isFallback: false,
    prefixes: ['682', '683'],
  },
  {
    name: 'Kerala Non-Local',
    code: 'kerala-non-local',
    baseFeePaise: 12000,
    freeShippingMinOrderPaise: 350000,
    priority: 20,
    isActive: true,
    isFallback: false,
    prefixes: [
      '670', '671', '672', '673', '674', '675', '676', '677', '678', '679',
      '680', '681', '684', '685', '686', '690', '691', '695',
    ],
  },
  {
    name: 'National Fallback',
    code: 'national-fallback',
    baseFeePaise: 18000,
    freeShippingMinOrderPaise: 500000,
    priority: 999,
    isActive: true,
    isFallback: true,
    prefixes: [],
  },
];

async function graphql(query, variables) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: token,
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });
  const payload = await response.json();
  if (payload.errors) {
    throw new Error(JSON.stringify(payload.errors, null, 2));
  }
  return payload.data;
}

for (const zone of zones) {
  const created = await graphql(
    `mutation CreateZone($input: CreateShippingZoneInput!) {
      createShippingZone(input: $input) { id code name }
    }`,
    {
      input: {
        name: zone.name,
        code: zone.code,
        baseFeePaise: zone.baseFeePaise,
        freeShippingMinOrderPaise: zone.freeShippingMinOrderPaise,
        priority: zone.priority,
        isActive: zone.isActive,
        isFallback: zone.isFallback,
        createdAtIso: now,
      },
    },
  );
  const zoneId = created.createShippingZone.id;
  console.log('Created zone', zone.code, zoneId);
  for (const prefix of zone.prefixes) {
    await graphql(
      `mutation CreatePrefix($input: CreateShippingPinPrefixInput!) {
        createShippingPinPrefix(input: $input) { prefix }
      }`,
      {
        input: {
          prefix,
          zoneId,
          zoneCode: zone.code,
          createdAtIso: now,
        },
      },
    );
    console.log('  prefix', prefix);
  }
}
