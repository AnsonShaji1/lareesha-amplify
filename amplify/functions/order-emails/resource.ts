import { definePythonFunction } from '../python-function';

export const orderEmails = definePythonFunction(import.meta.url, 'order-emails', {
  timeoutSeconds: 30,
});
