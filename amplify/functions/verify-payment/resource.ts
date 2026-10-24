import { definePythonFunction } from '../python-function';

export const verifyPayment = definePythonFunction(import.meta.url, 'verify-payment', {
  timeoutSeconds: 30,
});
