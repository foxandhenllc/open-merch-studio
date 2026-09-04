import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type Sourced } from '../services/api';
import { mapStudioError } from '../studio-view-model.selectors';
import type { QuoteBreakdown } from '../types/catalog';
import type { SurfaceError } from '../studio-view-model.types';
import {
  MAX_STUDIO_CART_LINES,
  prepareCartQuoteRequest,
  updateStudioCartItemQuantity,
  type StudioCartItem,
} from '../studio-cart';
import { clearStudioCart, readStudioCart, writeStudioCart } from '../studio-cart-persistence';

type GuestCartOptions = {
  sessionId?: string;
  studioPassId?: string;
  onSource: <T>(result: Sourced<T>) => T;
};

/** Owns guest cart persistence and combined quote freshness independently from the active design. */
export function useGuestCart({ sessionId, studioPassId, onSource }: GuestCartOptions) {
  const [items, setItems] = useState<StudioCartItem[]>([]);
  const [quote, setQuote] = useState<QuoteBreakdown | null>(null);
  const [quoteStale, setQuoteStale] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<SurfaceError>();
  const [hydratedSessionId, setHydratedSessionId] = useState('');
  const hydratedSession = useRef('');
  const quoteRequestId = useRef(0);
  const quoteController = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!sessionId || hydratedSession.current === sessionId) return;
    hydratedSession.current = sessionId;
    setItems(readStudioCart(sessionId));
    setHydratedSessionId(sessionId);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || hydratedSessionId !== sessionId) return;
    writeStudioCart(sessionId, items);
  }, [hydratedSessionId, items, sessionId]);

  const refreshQuote = useCallback(async () => {
    const request = prepareCartQuoteRequest({ items, sessionId, studioPassId });
    if (!request) {
      setQuote(null);
      setQuoteStale(false);
      return;
    }
    const requestId = ++quoteRequestId.current;
    quoteController.current?.abort();
    const controller = new AbortController();
    quoteController.current = controller;
    setQuoting(true);
    setError(undefined);
    try {
      const next = onSource(await api.quote(request, controller.signal));
      if (requestId !== quoteRequestId.current) return;
      setQuote(next);
      setQuoteStale(false);
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
      if (requestId !== quoteRequestId.current) return;
      setError(mapStudioError(requestError, 'quote'));
    } finally {
      if (requestId === quoteRequestId.current) {
        setQuoting(false);
        quoteController.current = null;
      }
    }
  }, [items, onSource, sessionId, studioPassId]);

  useEffect(() => {
    if (!items.length) {
      setQuote(null);
      setQuoteStale(false);
      return undefined;
    }
    setQuoteStale(true);
    const timer = window.setTimeout(() => void refreshQuote(), 450);
    return () => window.clearTimeout(timer);
  }, [items, refreshQuote]);

  useEffect(
    () => () => {
      quoteController.current?.abort();
    },
    []
  );

  const add = useCallback((item: StudioCartItem) => {
    setItems((current) =>
      current.length >= MAX_STUDIO_CART_LINES ? current : [...current, item]
    );
  }, []);

  const replace = useCallback((nextItems: StudioCartItem[]) => {
    setItems(nextItems.slice(0, MAX_STUDIO_CART_LINES));
  }, []);

  const remove = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? updateStudioCartItemQuantity(item, quantity) : item
      )
    );
  }, []);

  const clear = useCallback(() => {
    quoteRequestId.current += 1;
    quoteController.current?.abort();
    clearStudioCart();
    setItems([]);
    setQuote(null);
    setQuoteStale(false);
    setError(undefined);
  }, []);

  return {
    items,
    quote,
    quoteStale,
    quoteExpired: Boolean(quote && new Date(quote.expiresAt).getTime() <= Date.now()),
    quoting,
    error,
    add,
    replace,
    remove,
    updateQuantity,
    refreshQuote,
    clear,
  };
}
