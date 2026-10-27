import type { PreSignUpTriggerHandler } from 'aws-lambda';
import {
  AdminLinkProviderForUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  type UserType,
} from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient({});

function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function isFederatedUsername(username: string | undefined): boolean {
  if (!username) return false;
  return /^(google|facebook|apple|amazon|signinwithapple)_/i.test(username);
}

function parseExternalUsername(userName: string): { providerName: string; providerUserId: string } {
  const underscore = userName.indexOf('_');
  if (underscore <= 0) {
    throw new Error('Invalid external provider username');
  }
  const rawProvider = userName.slice(0, underscore);
  const providerUserId = userName.slice(underscore + 1);
  // Cognito IdP names from Amplify are PascalCase (e.g. Google).
  const providerName = rawProvider.charAt(0).toUpperCase() + rawProvider.slice(1).toLowerCase();
  return { providerName, providerUserId };
}

async function usersByEmail(userPoolId: string, email: string): Promise<UserType[]> {
  const response = await cognito.send(
    new ListUsersCommand({
      UserPoolId: userPoolId,
      Filter: `email = "${escapeFilterValue(email)}"`,
      Limit: 60,
    }),
  );
  return response.Users ?? [];
}

function pickDestinationUser(users: UserType[]): UserType | undefined {
  const natives = users
    .filter((user) => !isFederatedUsername(user.Username))
    .sort((a, b) => (a.UserCreateDate?.getTime() ?? 0) - (b.UserCreateDate?.getTime() ?? 0));
  if (natives.length) return natives[0];
  return undefined;
}

export const handler: PreSignUpTriggerHandler = async (event) => {
  const email = (event.request.userAttributes.email || '').trim();
  if (!email) {
    return event;
  }

  if (event.triggerSource === 'PreSignUp_ExternalProvider') {
    const existing = await usersByEmail(event.userPoolId, email);
    const destination = pickDestinationUser(existing);
    if (destination?.Username) {
      const { providerName, providerUserId } = parseExternalUsername(event.userName);
      try {
        await cognito.send(
          new AdminLinkProviderForUserCommand({
            UserPoolId: event.userPoolId,
            DestinationUser: {
              ProviderName: 'Cognito',
              ProviderAttributeValue: destination.Username,
            },
            SourceUser: {
              ProviderName: providerName,
              ProviderAttributeName: 'Cognito_Subject',
              ProviderAttributeValue: providerUserId,
            },
          }),
        );
      } catch (error: unknown) {
        const name = (error as { name?: string }).name;
        // Idempotent: already linked is fine.
        if (name !== 'InvalidParameterException' && name !== 'ResourceConflictException') {
          throw error;
        }
      }
    }

    event.response.autoConfirmUser = true;
    event.response.autoVerifyEmail = true;
    return event;
  }

  if (event.triggerSource === 'PreSignUp_SignUp') {
    const existing = await usersByEmail(event.userPoolId, email);
    if (existing.length > 0) {
      const hasFederated = existing.some((user) => isFederatedUsername(user.Username));
      if (hasFederated && existing.every((user) => isFederatedUsername(user.Username))) {
        throw new Error(
          'An account with this email already exists. Please sign in with Google, or use Sign in with your password if you already set one.',
        );
      }
      throw new Error(
        'An account with this email already exists. Please sign in, or use Continue with Google if you linked Google to this account.',
      );
    }
  }

  return event;
};
