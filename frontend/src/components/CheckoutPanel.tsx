import { useState } from 'react';
import { ErrorNote } from './ErrorNote';
import { QuoteLedger } from './QuoteLedger';
import type { CheckoutPanelProps } from './CheckoutPanel.types';

import { merchantConfig } from '../generated/merchant-config';

// The build verifies that this approval record pins the exact displayed operator policy document.
const CHECKOUT_POLICY_VERSION = merchantConfig.policies.approvedVersion;

export function CheckoutPanel({
  quote,
  quoting,
  quoteStale,
  quoteExpired,
  onRefreshQuote,
  email,
  onEmailChange,
  readiness,
  checkoutEnabled,
  checkoutBusy,
  checkoutError,
  onCheckout,
  onBack,
}: CheckoutPanelProps) {
  const [emailTouched, setEmailTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [policiesAccepted, setPoliciesAccepted] = useState(false);
  const showEmailError = (emailTouched || submitted) && !readiness.emailValid;
  const emailBlocker = readiness.blocker === 'Enter a valid email for your receipt.';
  const visibleBlocker =
    showEmailError && emailBlocker ? readiness.blocker : emailBlocker ? '' : readiness.blocker;

  const submit = () => {
    setSubmitted(true);
    if (readiness.emailValid && policiesAccepted) {
      onCheckout(true, CHECKOUT_POLICY_VERSION);
    }
  };

  return (
    <div className="panel-stack checkout-panel">
      <QuoteLedger
        quote={quote}
        loading={quoting}
        stale={quoteStale}
        expired={quoteExpired}
        onRefresh={onRefreshQuote}
        embedded
      />
      <label className="email-field">
        <span>Email for receipt</span>
        <input
          type="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          onBlur={() => setEmailTouched(true)}
          placeholder="you@example.com"
          autoComplete="email"
          required
          aria-invalid={showEmailError}
          aria-describedby="checkout-readiness-message"
        />
      </label>
      <p
        id="checkout-readiness-message"
        className={`checkout-gate ${visibleBlocker ? 'is-blocked' : ''}`}
      >
        {visibleBlocker || readiness.fulfillmentReview}
      </p>
      <details className="checkout-trust">
        <summary>Delivery and returns</summary>
        <p>
          Stripe shows the final charge, including applicable tax, before payment. Custom items can
          only be changed before production; damaged or misprinted items are covered by our{' '}
          <a href="/returns">returns policy</a>.
        </p>
      </details>
      <label className="checkout-assent">
        <input
          type="checkbox"
          checked={policiesAccepted}
          onChange={(event) => setPoliciesAccepted(event.target.checked)}
          required
        />
        <span>
          I confirm that I am at least 18, have reviewed the product, size, color, and artwork, and
          agree to the{' '}
          <a href="/terms" target="_blank" rel="noreferrer">
            Terms of Use
          </a>
          ,{' '}
          <a href="/returns" target="_blank" rel="noreferrer">
            Returns and Refunds Policy
          </a>
          ,{' '}
          <a href="/privacy" target="_blank" rel="noreferrer">
            Privacy Policy
          </a>
          , and{' '}
          <a href="/content-policy" target="_blank" rel="noreferrer">
            Content Policy
          </a>
          . I will review the shipping details and final tax shown by Stripe before payment.
        </span>
      </label>
      <button
        className="button button--primary button--wide"
        type="button"
        onClick={submit}
        disabled={!readiness.canOpen || !policiesAccepted || checkoutBusy}
        aria-describedby="checkout-readiness-message"
      >
        {checkoutBusy ? 'Opening checkout…' : 'Continue to secure checkout'}
      </button>
      {!checkoutEnabled && (
        <p className="disabled-reason">
          Secure checkout is temporarily unavailable. Your design and price stay saved.
        </p>
      )}
      <ErrorNote
        error={checkoutError}
        onRetry={() => {
          if (policiesAccepted) onCheckout(true, CHECKOUT_POLICY_VERSION);
        }}
      />
      <button className="text-action" type="button" onClick={onBack}>
        Back to design
      </button>
    </div>
  );
}
