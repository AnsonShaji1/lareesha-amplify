import { defineAuth, secret } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: {
      verificationEmailStyle: 'CODE',
    },
    externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
        scopes: ['openid', 'email', 'profile'],
        attributeMapping: {
          email: 'email',
          givenName: 'given_name',
          familyName: 'family_name',
        },
      },
      scopes: ['EMAIL', 'OPENID', 'PROFILE', 'COGNITO_ADMIN'],
      callbackUrls: [
        'http://localhost:4200/',
        'http://localhost:4200/sign-in',
        'http://localhost:4200/sign-up',
      ],
      logoutUrls: ['http://localhost:4200/', 'http://localhost:4200/sign-in'],
    },
  },
  groups: ['admin'],
  userAttributes: {
    givenName: { required: true, mutable: true },
    familyName: { mutable: true },
    phoneNumber: { mutable: true },
    gender: { mutable: true },
  },
});
