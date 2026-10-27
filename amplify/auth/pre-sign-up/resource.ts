import { defineFunction } from '@aws-amplify/backend';

export const preSignUp = defineFunction({
  name: 'pre-sign-up',
  // Keep the trigger in the auth stack to avoid circular dependencies.
  resourceGroupName: 'auth',
  entry: './handler.ts',
});
