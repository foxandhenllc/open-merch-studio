import { useCallback, useEffect, useRef, useState } from 'react';
import { clearPendingCustomerOrderAccess, readPendingCustomerOrderAccess } from '../order-access';
import { api, ApiError } from '../services/api';
import type { CustomerOrderAccess, CustomerOrderConfirmation } from '../types/catalog';

type UseOrderRevisitOptions = {
  studioReady: boolean;
  onConfirmedOrder: (order: CustomerOrderConfirmation, access?: CustomerOrderAccess) => void;
};

/** Restores the customer order referenced by an already-scrubbed email capability handoff. */
export function useOrderRevisit({ studioReady, onConfirmedOrder }: UseOrderRevisitOptions) {
  const access = useRef<CustomerOrderAccess | null>(null);
  if (access.current === null) access.current = readPendingCustomerOrderAccess();
  const [loading, setLoading] = useState(Boolean(access.current));
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!studioReady || !access.current) return undefined;
    let cancelled = false;
    const restore = async () => {
      setLoading(true);
      setError(null);
      setRetryable(true);
      try {
        const orderAccess = access.current;
        if (!orderAccess) return;
        const result = await api.order(orderAccess.orderId, orderAccess.token);
        if (cancelled) return;
        clearPendingCustomerOrderAccess();
        onConfirmedOrder(result.data, orderAccess);
      } catch (caught) {
        if (cancelled) return;
        if (caught instanceof ApiError && caught.status === 404) {
          clearPendingCustomerOrderAccess();
          access.current = null;
          setRetryable(false);
          setError('This private order link is no longer available. Contact support for help.');
        } else {
          setError('We could not load this order yet. Check your connection and try again.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void restore();
    return () => {
      cancelled = true;
    };
  }, [attempt, onConfirmedOrder, studioReady]);

  return {
    loading,
    error,
    retryable,
    retry: useCallback(() => setAttempt((value) => value + 1), []),
    dismiss: useCallback(() => setError(null), []),
  };
}
