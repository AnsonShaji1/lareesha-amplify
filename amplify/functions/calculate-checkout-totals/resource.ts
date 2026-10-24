import { definePythonFunction } from '../python-function';

export const calculateCheckoutTotals = definePythonFunction(
  import.meta.url,
  'calculate-checkout-totals',
);
