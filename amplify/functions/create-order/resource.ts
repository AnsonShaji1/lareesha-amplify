import { definePythonFunction } from '../python-function';

export const createOrder = definePythonFunction(import.meta.url, 'create-order', {
  timeoutSeconds: 30,
});
