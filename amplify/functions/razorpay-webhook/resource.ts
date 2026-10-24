import { definePythonFunction } from '../python-function';

export const razorpayWebhook = definePythonFunction(import.meta.url, 'razorpay-webhook', {
  timeoutSeconds: 30,
});
