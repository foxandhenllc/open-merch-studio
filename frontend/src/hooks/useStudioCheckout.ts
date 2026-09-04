import { useCallback, useState } from 'react';
import { canUseCustomerCheckout } from '../config';
import {
  checkoutNotReadyError,
  checkoutUnavailable,
  classifyCheckoutResult,
  orderDetailsPendingError,
  prepareCheckoutRequest,
} from '../studio-checkout';
import type { FlowState, SurfaceError, WorkbenchMode } from '../studio-view-model.types';
import { mapStudioError } from '../studio-view-model.selectors';
import { api, type Sourced } from '../services/api';
import type {
  CheckoutSession,
  CustomerOrderConfirmation,
  DesignDraft,
  QuoteBreakdown,
  StudioPass,
  StudioSession,
} from '../types/catalog';
import { trackEvent } from '../utils/analytics';

const PENDING_CART_CHECKOUT_KEY = 'open-merch-studio:pending-cart-checkout:v1';

export type CheckoutSource = 'design' | 'cart';

type CheckoutReadiness = {
  ready: boolean;
  blocker: string;
};

type UseStudioCheckoutOptions = {
  session: StudioSession | null;
  studioPass: StudioPass | null;
  email: string;
  design: DesignDraft | null;
  quote: QuoteBreakdown | null;
  cartQuote: QuoteBreakdown | null;
  designReadiness: CheckoutReadiness;
  cartReadiness: CheckoutReadiness;
  onStudioPassChange: (studioPass: StudioPass) => void;
  onCartClear: () => void;
  onSource: <T>(result: Sourced<T>) => T;
  onFlowChange: (flow: FlowState) => void;
  onModeChange: (mode: WorkbenchMode) => void;
  onAnnouncement: (message: string) => void;
};

/**
 * Owns customer checkout commands and their transient state.
 *
 * Stripe redirect is intentionally only a handoff: order confirmation remains dependent on the
 * signed-webhook-backed lookup performed after the customer returns to the studio.
 */
export function useStudioCheckout({
  session,
  studioPass,
  email,
  design,
  quote,
  cartQuote,
  designReadiness,
  cartReadiness,
  onStudioPassChange,
  onCartClear,
  onSource,
  onFlowChange,
  onModeChange,
  onAnnouncement,
}: UseStudioCheckoutOptions) {
  const [source, setSource] = useState<CheckoutSource>('design');
  const [checkout, setCheckout] = useState<CheckoutSession | null>(null);
  const [order, setOrder] = useState<CustomerOrderConfirmation | null>(null);
  const [passBusy, setPassBusy] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [errors, setErrors] = useState<{
    checkout?: SurfaceError;
    order?: SurfaceError;
  }>({});

  const clearError = useCallback((surface: 'checkout' | 'order') => {
    setErrors((current) => ({ ...current, [surface]: undefined }));
  }, []);

  const clearCheckout = useCallback(() => setCheckout(null), []);
  const clearResults = useCallback(() => {
    setCheckout(null);
    setOrder(null);
  }, []);

  const buyStudioPass = async () => {
    if (!session) return;
    if (!canUseCustomerCheckout) {
      setCheckout(checkoutUnavailable());
      return;
    }
    setPassBusy(true);
    clearError('checkout');
    try {
      const result = onSource(await api.studioPassCheckout(session.id));
      setCheckout(result);
      if (result.status === 'open' && result.checkoutUrl) {
        trackEvent('studio_pass_checkout_started', {
          source: 'gate',
          result: result.mode === 'stripe' ? 'live' : 'fallback',
        });
        onAnnouncement('Opening secure checkout.');
        window.location.assign(result.checkoutUrl);
        return;
      }
      if (result.studioPassId) {
        onStudioPassChange({
          id: result.studioPassId,
          sessionId: session.id,
          status: 'simulated',
          priceCents: 500,
          creditCents: 500,
          includedRoughDrafts: 8,
          includedEdits: 2,
          includedFinals: 1,
          roughDraftsUsed: 0,
          editsUsed: 0,
          finalsUsed: 0,
          createdAt: new Date().toISOString(),
        });
      }
      onAnnouncement(
        'Studio Pass activated. The eligible order credit will be applied automatically.'
      );
    } catch (error) {
      setErrors((current) => ({
        ...current,
        checkout: mapStudioError(error, 'checkout'),
      }));
    } finally {
      setPassBusy(false);
    }
  };

  const createCheckout = async (policyAccepted: true, policyVersion: string) => {
    const activeQuote = source === 'cart' ? cartQuote : quote;
    const activeReadiness = source === 'cart' ? cartReadiness : designReadiness;
    if (!activeQuote || !activeReadiness.ready) {
      setErrors((current) => ({
        ...current,
        checkout: checkoutNotReadyError(activeReadiness.blocker),
      }));
      return;
    }
    if (!canUseCustomerCheckout) {
      setCheckout(checkoutUnavailable(activeQuote.id));
      return;
    }

    setCheckoutBusy(true);
    // The marker survives Stripe navigation so a confirmed cart order can be cleared exactly once.
    if (source === 'cart') window.sessionStorage.setItem(PENDING_CART_CHECKOUT_KEY, 'true');
    else window.sessionStorage.removeItem(PENDING_CART_CHECKOUT_KEY);
    onFlowChange('ordering');
    clearError('checkout');
    clearError('order');
    try {
      const result = onSource(
        await api.checkout(
          prepareCheckoutRequest({
            quote: activeQuote,
            sessionId: session?.id,
            studioPassId: studioPass?.id,
            email,
            design: source === 'cart' ? null : design,
            policyAccepted,
            policyVersion,
          })
        )
      );
      setCheckout(result);
      const outcome = classifyCheckoutResult(result);
      if (outcome.kind === 'redirect') {
        trackEvent('checkout_started', {
          source: 'quote',
          studio_pass: Boolean(studioPass),
        });
        onFlowChange('redirecting');
        onAnnouncement('Checkout ready. Redirecting to secure payment.');
        window.location.assign(outcome.checkoutUrl);
        return;
      }
      if (outcome.kind === 'inline-order') {
        if (source === 'cart') onCartClear();
        setOrder(outcome.order);
        onFlowChange('confirmed');
        onAnnouncement(`Order ${outcome.order.orderNumber} confirmed.`);
        onModeChange('order');
      } else if (outcome.kind === 'lookup-order') {
        try {
          const nextOrder = onSource(await api.order(outcome.orderId));
          if (source === 'cart') onCartClear();
          setOrder(nextOrder);
          onFlowChange('confirmed');
          onAnnouncement(`Order ${nextOrder.orderNumber} confirmed.`);
          onModeChange('order');
        } catch (error) {
          onFlowChange('confirmed');
          setErrors((current) => ({
            ...current,
            order: orderDetailsPendingError(error),
          }));
        }
      }
    } catch (error) {
      setErrors((current) => ({
        ...current,
        checkout: mapStudioError(error, 'checkout'),
      }));
      onFlowChange('quoted');
    } finally {
      setCheckoutBusy(false);
    }
  };

  const acceptConfirmedOrder = useCallback(
    (confirmedOrder: CustomerOrderConfirmation) => {
      if (window.sessionStorage.getItem(PENDING_CART_CHECKOUT_KEY)) {
        onCartClear();
        window.sessionStorage.removeItem(PENDING_CART_CHECKOUT_KEY);
      }
      setOrder(confirmedOrder);
      onFlowChange('confirmed');
      onAnnouncement(`Order ${confirmedOrder.orderNumber} is ready to review.`);
      onModeChange('order');
    },
    [onAnnouncement, onCartClear, onFlowChange, onModeChange]
  );

  return {
    source,
    setSource,
    checkout,
    order,
    busy: { pass: passBusy, checkout: checkoutBusy },
    errors,
    clearError,
    clearCheckout,
    clearResults,
    buyStudioPass,
    createCheckout,
    acceptConfirmedOrder,
    clearPendingCartCheckout: () => window.sessionStorage.removeItem(PENDING_CART_CHECKOUT_KEY),
  };
}
