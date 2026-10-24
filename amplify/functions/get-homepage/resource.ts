import { definePythonFunction } from '../python-function';

export const getHomepage = definePythonFunction(import.meta.url, 'get-homepage', {
  timeoutSeconds: 20,
});
