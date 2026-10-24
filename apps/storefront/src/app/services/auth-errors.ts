/** Amplify / Cognito auth errors use `name` + `message`, not Django `error.error`. */

export function authErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const err = error as {
    name?: string;
    message?: string;
    code?: string;
    error?: { error?: string; detail?: string; non_field_errors?: string[]; email?: string[] };
  } | null;

  const name = err?.name || err?.code || '';
  const message = (err?.message || '').trim();
  const lower = message.toLowerCase();

  if (
    name === 'InvalidParameterException' ||
    name === 'NotAuthorizedException' ||
    /external|federated|cannot reset|no registered\/verified|password.*not.*set|user does not have/i.test(
      lower,
    )
  ) {
    return 'This account uses Google sign-in. Use Continue with Google on the sign-in page.';
  }

  if (name === 'UserNotFoundException') {
    return 'No account found for that email.';
  }

  if (name === 'LimitExceededException' || name === 'TooManyRequestsException') {
    return 'Too many attempts. Try again later.';
  }

  if (name === 'CodeDeliveryFailureException') {
    return 'We couldn’t send the email. Try again later.';
  }

  if (name === 'CodeMismatchException' || name === 'ExpiredCodeException') {
    return message || 'Invalid or expired code. Request a new one.';
  }

  if (name === 'InvalidPasswordException') {
    return message || 'Password does not meet the requirements.';
  }

  return (
    message ||
    err?.error?.error ||
    err?.error?.detail ||
    err?.error?.non_field_errors?.[0] ||
    err?.error?.email?.[0] ||
    fallback
  );
}
