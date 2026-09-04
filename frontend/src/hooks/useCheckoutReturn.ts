import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { parseCheckoutHandoff, removeCheckoutHandoffParams } from '../checkout-return';
import { api } from '../services/api';
import type { CheckoutConfirmation, CustomerOrderConfirmation } from '../types/catalog';
import { trackEvent } from '../utils/analytics';

const PENDING_CHECKOUT_KEY = 'open-merch-studio:pending-checkout:v1';

const readPendingCheckoutSession = (): string | null => {
  try {
    const value = window.sessionStorage.getItem(PENDING_CHECKOUT_KEY);
    return value?.startsWith('cs_') ? value : null;
  } catch {
    return null;
  }
};

const savePendingCheckoutSession = (sessionId: string | null) => {
  try {
    if (sessionId) window.sessionStorage.setItem(PENDING_CHECKOUT_KEY, sessionId);
    else window.sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
  } catch {
    // The active page can still reconcile payment when session storage is unavailable.
  }
};

type UseCheckoutReturnOptions = {
  studioReady: boolean;
  onConfirmedOrder: (order: CustomerOrderConfirmation) => void;
};

export function useCheckoutReturn({
  studioReady,
  onConfirmedOrder,
}: UseCheckoutReturnOptions) {
  const handoff = useRef<ReturnType<typeof parseCheckoutHandoff> | null>(null);
  if (!handoff.current) {
    handoff.current = parseCheckoutHandoff(window.location.search, readPendingCheckoutSession());
    if ('pendingSessionUpdate' in handoff.current) {
      savePendingCheckoutSession(handoff.current.pendingSessionUpdate ?? null);
    }
  }

  const [confirmation, setConfirmation] = useState<CheckoutConfirmation | null>(null);
  const [polling, setPolling] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useLayoutEffect(() => {
    if (!handoff.current?.state && !handoff.current?.sessionId) return;
    const remainingQuery = removeCheckoutHandoffParams(window.location.search);
    window.history.replaceState(
      window.history.state,
      document.title,
      `${window.location.pathname}${remainingQuery ? `?${remainingQuery}` : ''}${window.location.hash}`
    );
  }, []);

  useEffect(() => {
    if (!studioReady) return undefined;
    const checkoutState = handoff.current?.state ?? null;
    const stripeSessionId = handoff.current?.sessionId ?? null;
    if (checkoutState === 'cancelled') {
      savePendingCheckoutSession(null);
      trackEvent('checkout_returned', { result: 'cancelled', mode: 'live' });
      setConfirmation({
        state: 'failed',
        message: 'Checkout was cancelled. No payment was made.',
      });
      return undefined;
    }
    if (checkoutState !== 'success' || !stripeSessionId) return undefined;

    let cancelled = false;
    setPolling(true);
    setConfirmation({
      state: 'processing',
      message: 'Stripe returned successfully. Confirming your payment now.',
    });
    const confirm = async () => {
      try {
        for (let poll = 0; poll < 30 && !cancelled; poll += 1) {
          try {
            const result = await api.checkoutOrder(stripeSessionId);
            const nextConfirmation = result.data;
            setConfirmation(nextConfirmation);
            if (nextConfirmation.state !== 'processing') {
              savePendingCheckoutSession(null);
              if (nextConfirmation.order) onConfirmedOrder(nextConfirmation.order);
              trackEvent('checkout_returned', {
                result: nextConfirmation.state === 'failed' ? 'unknown' : 'success',
                mode: 'live',
              });
              return;
            }
          } catch {
            // Stripe may redirect before its signed webhook has been reconciled.
          }
          await new Promise((resolve) => window.setTimeout(resolve, 2_000));
        }
        if (!cancelled) {
          trackEvent('checkout_returned', { result: 'unknown', mode: 'live' });
          setConfirmation({
            state: 'processing',
            message: 'Confirmation is still processing. Do not submit another payment.',
          });
        }
      } finally {
        if (!cancelled) setPolling(false);
      }
    };
    void confirm();
    return () => {
      cancelled = true;
    };
  }, [attempt, onConfirmedOrder, studioReady]);

  return {
    confirmation,
    polling,
    retry: useCallback(() => setAttempt((value) => value + 1), []),
    dismiss: useCallback(() => setConfirmation(null), []),
  };
}
