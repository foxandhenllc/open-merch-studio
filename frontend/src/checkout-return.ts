export type CheckoutHandoff = {
  state: string | null;
  sessionId: string | null;
  pendingSessionUpdate?: string | null;
};

export const parseCheckoutHandoff = (
  search: string,
  savedSessionId: string | null
): CheckoutHandoff => {
  const params = new URLSearchParams(search);
  const state = params.get('checkout');
  const urlSessionId = params.get('session_id');
  const validUrlSessionId = urlSessionId?.startsWith('cs_') ? urlSessionId : null;

  if (state === 'cancelled') {
    return { state, sessionId: null, pendingSessionUpdate: null };
  }
  if (state === 'success' && validUrlSessionId) {
    return { state, sessionId: validUrlSessionId, pendingSessionUpdate: validUrlSessionId };
  }
  return {
    state: state ?? (savedSessionId ? 'success' : null),
    sessionId: validUrlSessionId ?? savedSessionId,
  };
};

export const removeCheckoutHandoffParams = (search: string): string => {
  const params = new URLSearchParams(search);
  params.delete('checkout');
  params.delete('session_id');
  return params.toString();
};
