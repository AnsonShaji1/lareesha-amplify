import { definePythonFunction } from '../python-function';

export const cleanupReservations = definePythonFunction(
  import.meta.url,
  'cleanup-reservations',
  { timeoutSeconds: 60 },
);
