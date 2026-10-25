import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import outputs from '../environments/amplify_outputs.json';

/**
 * Cognito token exchange requires the exact same redirect_uri as /oauth2/authorize.
 * With multiple same-origin callbackUrls (/ vs /sign-in), Amplify can pick different
 * ones for authorize vs token → unauthorized_client / invalid_redirect.
 * Pin both to `${origin}/` when that origin is allowlisted.
 */
function outputsWithPinnedOAuthRedirects(raw: typeof outputs) {
  const config = structuredClone(raw) as typeof outputs & {
    auth?: {
      oauth?: {
        redirect_sign_in_uri?: string[];
        redirect_sign_out_uri?: string[];
      };
    };
  };
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  if (!origin || !config.auth?.oauth) return config;

  const preferred = `${origin}/`;
  const allowedIn = config.auth.oauth.redirect_sign_in_uri || [];
  const allowedOut = config.auth.oauth.redirect_sign_out_uri || [];
  const originAllowed = allowedIn.some(
    (uri) => uri === preferred || uri.startsWith(`${origin}/`) || uri === origin,
  );
  if (!originAllowed) return config;

  config.auth.oauth.redirect_sign_in_uri = [preferred];
  config.auth.oauth.redirect_sign_out_uri = allowedOut.some(
    (uri) => uri === preferred || uri.startsWith(`${origin}/`) || uri === origin,
  )
    ? [preferred]
    : allowedOut;
  return config;
}

Amplify.configure(outputsWithPinnedOAuthRedirects(outputs) as any);

export const dataClient = generateClient({
  authMode: 'userPool',
}) as any;

export const publicClient = generateClient({
  authMode: 'apiKey',
}) as any;
