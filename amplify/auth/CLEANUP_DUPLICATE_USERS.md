# One-time cleanup: duplicate Cognito emails

After the Pre sign-up linker is deployed, clean existing duplicates in the Cognito console
(User pools → Users). Example: `ansonshaji9@gmail.com` had multiple rows (Cognito UUID + `google_…`).

## Why this matters

Orders, addresses, cart, and wishlist are keyed by Cognito `sub`. Deleting the wrong user
drops access to that data. Keep the account that already has real store data.

## Steps

1. In Cognito → Users, filter by the email.
2. Open each user and note:
   - Username (UUID vs `google_…`)
   - Email verified
   - Whether they have orders in admin (match `userId` / owner to the Cognito `sub`)
3. **Keep one primary user**
   - Prefer the **email-verified Cognito** user that owns orders/wishlist.
   - If only Google rows exist and one has data, keep that `google_…` user.
4. **Delete** the other rows for that email (extra UUID and extra `google_…` users).
5. Sign in on the storefront:
   - Email/password for the kept Cognito user, **or**
   - Continue with Google once (linker attaches Google to the Cognito user if needed).
6. If Google shows “linked — continue once more”, click Continue with Google again.

## Going forward

- Email/password signup for an existing email is blocked by Pre sign-up.
- Google for an existing Cognito email is linked instead of creating a second person.
