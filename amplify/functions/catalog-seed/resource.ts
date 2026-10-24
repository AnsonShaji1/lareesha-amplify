import { definePythonFunction } from '../python-function';

export const catalogSeed = definePythonFunction(import.meta.url, 'catalog-seed', {
  timeoutSeconds: 900,
  memorySize: 1024,
});
