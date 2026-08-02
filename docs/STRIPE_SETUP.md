# Stripe setup

Billing is inert until these are set. Nothing in the app can charge a card
before then, and every tenant sits on the free plan.

**Use test keys first.** Everything below works identically in test mode.

## 1. Products and prices

In the Stripe dashboard create two recurring prices:

| Product | Billing | Env var |
|---|---|---|
| Member Pro | monthly, per subscription | `STRIPE_PRICE_MEMBER_PRO` |
| Enterprise Seat | monthly, **per unit** | `STRIPE_PRICE_ENTERPRISE_SEAT` |

Copy each `price_...` id into the matching variable. A subscription to a price
that is not one of these grants **no** plan — that is deliberate, so a stray
product cannot unlock paid features.

## 2. Keys

- `STRIPE_SECRET_KEY` — `sk_test_...` to begin with.

## 3. Webhook

Create an endpoint pointing at `https://<your-app>/api/billing/webhook` and
subscribe to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

**This secret is the entire security boundary of billing.** The endpoint cannot
use a session — Stripe has none — so the signature is all that distinguishes a
real event from a forged one. Until it is set, the route refuses every request
rather than trusting the body.

Test locally with the Stripe CLI:

```
stripe listen --forward-to localhost:3000/api/billing/webhook
stripe trigger checkout.session.completed
```

## 4. Verify

1. `/billing` should stop saying "billing is not enabled"
2. Subscribe with test card `4242 4242 4242 4242`
3. `/admin/billing` should show the subscription and the processed webhook event
4. The entitlement should take effect — a Member Pro tenant loses the monthly
   assistant cap

## How entitlements stay in sync

Stripe is the source of truth for money; the local `Subscription` row is a
projection kept current by webhooks. Entitlement checks read the projection, so
a Stripe outage degrades billing *administration* rather than the product.

If the projection ever looks wrong, `/admin/billing` lists recent webhook
events with their processing state — an errored or pending row is the usual
cause.

## Deliberate behaviours worth knowing

- **`PAST_DUE` keeps access.** A failed card starts a dunning conversation, not
  an instant lockout of someone's health record. Stripe moves the subscription
  to `CANCELED` when retries are exhausted, and that is when access stops.
- **Cancelling reverts to FREE, not to nothing.** An expired subscriber keeps
  basic access to their own data.
- **Events are de-duplicated on Stripe's event id.** Stripe retries and does not
  guarantee exactly-once delivery; without this a retried event could extend a
  subscription twice, which reaches customers as free months.
