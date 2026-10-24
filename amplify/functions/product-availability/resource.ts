import { definePythonFunction } from '../python-function';

export const productAvailability = definePythonFunction(import.meta.url, 'product-availability', {
  timeoutSeconds: 20,
});
