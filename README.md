# Lareesha Luxe — Amplify Gen 2

Rebuild of the Lareesha Luxe store on AWS Amplify Gen 2. The original Angular + Django apps in sibling folders remain reference-only.

## Layout

- `amplify/` — Auth, Data, Python Lambdas, EventBridge, SES, Razorpay webhook
- `apps/storefront` — customer storefront
- `apps/admin` — admin app (Cognito `admin` group)

## Prerequisites

- Node.js 20+
- AWS credentials (`aws sts get-caller-identity`)
- Amplify sandbox secrets and SSM parameters (see below)

## Secrets

Google Hosted UI is optional. Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `scripts/ssm.local.env`. `npm run ssm:secrets` stores those as Amplify sandbox secrets, which is what Cognito reads. R2 and Razorpay values in the same file are stored in **SSM Parameter Store** under `/lareesha/*`. Lambdas read those at runtime.

```
copy scripts\ssm.local.env.example scripts\ssm.local.env
# fill in R2 and Razorpay values
npm run ssm:secrets
```

That command also sets R2 CORS so the admin browser can PUT images from `localhost:4201`. To apply CORS only:

```
npm run r2:cors
```

Signup confirmation codes use Cognito’s default email sender so they work without SES production access. Order emails still send from `noreply@lareeshaluxe.com` and need that SES identity verified (and SES out of sandbox to reach real customers).

## Local backend

```
npm install
npx ampx sandbox
```

Then start the apps:

```
npm run storefront   # http://localhost:4200
npm run admin        # http://localhost:4201
```

Seed shipping zones after an admin user exists:

```
$env:AMPLIFY_ADMIN_ID_TOKEN = "<id token>"
node scripts/seed-shipping.mjs
```

Catalog import is done from the admin app (upload JSON, then `catalogSeed`).

## Razorpay webhook

Sandbox prints `RazorpayWebhookUrl`. Point Razorpay events `payment.captured` and `payment.failed` at that Function URL.
