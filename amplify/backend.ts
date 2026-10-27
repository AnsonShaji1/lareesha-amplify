import { defineBackend } from '@aws-amplify/backend';
import { Stack, CfnOutput } from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auth } from './auth/resource';
import { preSignUp } from './auth/pre-sign-up/resource';
import { data } from './data/resource';
import { createOrder } from './functions/create-order/resource';
import { verifyPayment } from './functions/verify-payment/resource';
import { paymentFailed } from './functions/payment-failed/resource';
import { calculateCheckoutTotals } from './functions/calculate-checkout-totals/resource';
import { validatePincode } from './functions/validate-pincode/resource';
import { getHomepage } from './functions/get-homepage/resource';
import { productAvailability } from './functions/product-availability/resource';
import { getMediaUploadUrl } from './functions/get-media-upload-url/resource';
import { deleteMedia } from './functions/delete-media/resource';
import { catalogSeed } from './functions/catalog-seed/resource';
import { allocateProductCode } from './functions/allocate-product-code/resource';
import { cleanupReservations } from './functions/cleanup-reservations/resource';
import { orderEmails } from './functions/order-emails/resource';
import { razorpayWebhook } from './functions/razorpay-webhook/resource';
import { setDefaultAddress } from './functions/set-default-address/resource';
import { listUsers } from './functions/list-users/resource';

const backend = defineBackend({
  auth,
  // Import so we can attach Cognito AdminLinkProviderForUser (not in Amplify access map yet).
  preSignUp,
  data,
  createOrder,
  verifyPayment,
  paymentFailed,
  calculateCheckoutTotals,
  validatePincode,
  getHomepage,
  productAvailability,
  getMediaUploadUrl,
  deleteMedia,
  catalogSeed,
  allocateProductCode,
  cleanupReservations,
  orderEmails,
  razorpayWebhook,
  setDefaultAddress,
  listUsers,
});

const cfnUserPool = backend.auth.resources.cfnResources.cfnUserPool;
cfnUserPool.addPropertyDeletionOverride('Schema');
cfnUserPool.emailConfiguration = {
  emailSendingAccount: 'COGNITO_DEFAULT',
};

// Wildcard ARN avoids UserPool ↔ PreSignUp Lambda circular dependency in the auth stack.
backend.preSignUp.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({
    actions: [
      'cognito-idp:ListUsers',
      'cognito-idp:AdminLinkProviderForUser',
      'cognito-idp:AdminGetUser',
    ],
    resources: ['*'],
  }),
);

const amplifyDir = path.dirname(fileURLToPath(import.meta.url));
const dataStack = Stack.of(backend.createOrder.resources.lambda);

/** Amplify sandbox disables rollback, so LayerVersion cannot be replaced in place. */
function hashLayerSource(dir: string): string {
  const hash = createHash('sha256');
  const walk = (current: string) => {
    for (const name of readdirSync(current).sort()) {
      if (name === '__pycache__' || name.endsWith('.pyc')) {
        continue;
      }
      const full = path.join(current, name);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      hash.update(name);
      hash.update(readFileSync(full));
    }
  };
  walk(dir);
  return hash.digest('hex').slice(0, 12);
}

const layerDir = path.join(amplifyDir, 'shared/python-layer');
const sharedLayer = new lambda.LayerVersion(
  dataStack,
  `LareeshaPythonLayer${hashLayerSource(layerDir)}`,
  {
    compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
    code: lambda.Code.fromAsset(layerDir, {
      exclude: ['**/__pycache__', '**/*.pyc'],
    }),
    description: 'Shared Lareesha Luxe Python helpers',
  },
);

const tableMap: Record<string, string> = {
  CATEGORY_TABLE: 'Category',
  PRODUCT_TABLE: 'Product',
  ADDRESS_TABLE: 'Address',
  CART_ITEM_TABLE: 'CartItem',
  WISHLIST_ITEM_TABLE: 'WishlistItem',
  ORDER_TABLE: 'Order',
  PAYMENT_TRANSACTION_TABLE: 'PaymentTransaction',
  STOCK_RESERVATION_TABLE: 'StockReservation',
  SHIPPING_TABLE: 'Shipping',
  CATALOG_SEED_JOB_TABLE: 'CatalogSeedJob',
  SEQUENCE_TABLE: 'Sequence',
};

const functions = [
  backend.createOrder,
  backend.verifyPayment,
  backend.paymentFailed,
  backend.calculateCheckoutTotals,
  backend.validatePincode,
  backend.getHomepage,
  backend.productAvailability,
  backend.getMediaUploadUrl,
  backend.deleteMedia,
  backend.catalogSeed,
  backend.allocateProductCode,
  backend.cleanupReservations,
  backend.orderEmails,
  backend.razorpayWebhook,
  backend.setDefaultAddress,
  backend.listUsers,
];

function asLambda(fn: lambda.IFunction): lambda.Function {
  return fn as lambda.Function;
}

for (const fn of functions) {
  const lambdaFn = asLambda(fn.resources.lambda);
  lambdaFn.addLayers(sharedLayer);
  lambdaFn.addToRolePolicy(
    new iam.PolicyStatement({
      actions: ['ssm:GetParameter', 'ssm:GetParameters'],
      resources: [
        `arn:aws:ssm:${dataStack.region}:${dataStack.account}:parameter/lareesha/*`,
      ],
    }),
  );
  lambdaFn.addToRolePolicy(
    new iam.PolicyStatement({
      actions: [
        'dynamodb:DescribeTable',
        'dynamodb:Query',
        'dynamodb:Scan',
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:BatchGetItem',
        'dynamodb:BatchWriteItem',
      ],
      resources: [
        `arn:aws:dynamodb:${dataStack.region}:${dataStack.account}:table/*`,
        `arn:aws:dynamodb:${dataStack.region}:${dataStack.account}:table/*/index/*`,
      ],
    }),
  );
  lambdaFn.addEnvironment('SECRET_PREFIX', '/lareesha');
  lambdaFn.addEnvironment('FROM_EMAIL', 'noreply@lareeshaluxe.com');
  lambdaFn.addEnvironment('SITE_BRAND_NAME', 'Lareesha Luxe');
  lambdaFn.addEnvironment(
    'ORDER_OWNER_NOTIFICATION_EMAILS',
    'ansonshaji8@gmail.com,kichupoulose@gmail.com',
  );

  for (const [envName, modelName] of Object.entries(tableMap)) {
    const table = backend.data.resources.tables[modelName];
    lambdaFn.addEnvironment(envName, table.tableName);
    table.grantReadWriteData(lambdaFn);
  }
}

backend.verifyPayment.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({ actions: ['events:PutEvents'], resources: ['*'] }),
);
backend.razorpayWebhook.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({ actions: ['events:PutEvents'], resources: ['*'] }),
);
backend.orderEmails.resources.lambda.addToRolePolicy(
  new iam.PolicyStatement({ actions: ['ses:SendEmail', 'ses:SendRawEmail'], resources: ['*'] }),
);

const listUsersFn = asLambda(backend.listUsers.resources.lambda);
listUsersFn.addEnvironment('USER_POOL_ID', backend.auth.resources.userPool.userPoolId);
listUsersFn.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['cognito-idp:ListUsers', 'cognito-idp:ListUsersInGroup'],
    resources: [backend.auth.resources.userPool.userPoolArn],
  }),
);

const expireFn = asLambda(backend.cleanupReservations.resources.lambda);
const schedulerRole = new iam.Role(dataStack, 'ReservationExpirySchedulerRole', {
  assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
});
expireFn.grantInvoke(schedulerRole);

const holdScheduleArn = `arn:aws:scheduler:${dataStack.region}:${dataStack.account}:schedule/default/hold-*`;
const createOrderFn = asLambda(backend.createOrder.resources.lambda);
createOrderFn.addEnvironment('SCHEDULER_ROLE_ARN', schedulerRole.roleArn);
createOrderFn.addEnvironment('EXPIRE_RESERVATION_LAMBDA_ARN', expireFn.functionArn);
createOrderFn.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['scheduler:CreateSchedule', 'scheduler:DeleteSchedule'],
    resources: [holdScheduleArn],
  }),
);
createOrderFn.addToRolePolicy(
  new iam.PolicyStatement({
    actions: ['iam:PassRole'],
    resources: [schedulerRole.roleArn],
    conditions: { StringEquals: { 'iam:PassedToService': 'scheduler.amazonaws.com' } },
  }),
);

for (const fn of [backend.verifyPayment, backend.paymentFailed, backend.razorpayWebhook]) {
  asLambda(fn.resources.lambda).addToRolePolicy(
    new iam.PolicyStatement({
      actions: ['scheduler:DeleteSchedule'],
      resources: [holdScheduleArn],
    }),
  );
}

new events.Rule(dataStack, 'OrderPaidEmailRule', {
  eventPattern: {
    source: ['lareesha.orders'],
    detailType: ['OrderPaid'],
  },
}).addTarget(new targets.LambdaFunction(backend.orderEmails.resources.lambda));

const webhookUrl = asLambda(backend.razorpayWebhook.resources.lambda).addFunctionUrl({
  authType: lambda.FunctionUrlAuthType.NONE,
});

new CfnOutput(dataStack, 'RazorpayWebhookUrl', {
  value: webhookUrl.url,
});

const reservationTable =
  backend.data.resources.cfnResources.amplifyDynamoDbTables['StockReservation'];
if (reservationTable) {
  reservationTable.timeToLiveAttribute = {
    attributeName: 'expiresAtEpoch',
    enabled: true,
  };
}

export { backend };
