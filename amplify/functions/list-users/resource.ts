import { definePythonFunction } from '../python-function';

export const listUsers = definePythonFunction(import.meta.url, 'list-users');
