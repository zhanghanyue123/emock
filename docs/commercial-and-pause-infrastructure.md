# Commercial and Pause Infrastructure

## Pause Timing

Structured practice now stores one timing object on each attempt:

- `status`: `running`, `paused`, `expired`, or `completed`
- `remainingSeconds`
- `lastTickAt`
- `pausedAt` / `resumedAt`
- `pauseCount`
- `totalPausedSeconds`

When a running attempt is reopened, elapsed wall-clock time since `lastTickAt` is deducted. When an attempt is paused, time is not deducted and the pause overlay blocks the exam content. Resume adds the pause duration to `totalPausedSeconds` and restarts from the saved `remainingSeconds`.

The current TOEFL structured shell uses a `PauseConfig` with development mode allowing pause. The data model supports `allowed`, `practice_only`, and `disabled`; future full mock mode should pass a stricter policy from the exam definition or pack config.

## Auth Boundary

The project now has an `AuthAdapter` in `lib/server/auth-adapter.ts`.

Current implementation:

- `DevAuthAdapter`
- email-only test accounts
- HTTP-only session cookie
- no project-owned password storage or password hashing

Production should replace this adapter with a real provider such as Auth.js, Clerk, Supabase Auth, or a managed identity system.

## Server Data Store

Commercial test data is stored through a server-side repository boundary in `lib/server/dev-database.ts`.

Current implementation:

- file-backed development database: `data/dev-commerce.json`
- users
- sessions
- entitlements
- orders
- payment events

This is not localStorage and is suitable for local commercial-flow testing only. Production should replace this with a real database through the same repository boundary.

## Plans and Entitlements

Plans are centralized in `lib/plans.ts`.

Implemented plans:

- `free`
- `personal_monthly`
- `personal_quarterly`
- `pro_monthly` hidden for now

Feature checks use `canAccessFeature(entitlement, feature)` instead of checking plan names in pages.

## Payments

The current payment provider is `ManualTestPaymentProvider` in `lib/server/payment-provider.ts`.

It creates server-side pending orders and confirms them through `/api/payment/manual-confirm`. Confirmation uses a provider event idempotency key so duplicate confirmations do not extend membership twice.

Manual test payments are disabled in production. A real provider should implement the `PaymentProvider` interface and verify webhook signatures before activating membership.

## Pages

- `/pricing`
- `/account`
- `/account/billing`
- `/checkout`
- `/payment/success`
- `/payment/canceled`

## Local Data Migration

Browser data now uses `exam.*` keys. When an `exam.*` key is missing, the storage layer copies the matching legacy `toefl.*` key and records the migration in `exam.migrationLog`. Legacy keys are not deleted automatically.
