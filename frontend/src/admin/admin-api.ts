/** Admin credentials remain in component memory and never enter URLs, analytics, or browser storage. */
export async function adminRequest<T>(
  accessCode: string,
  path: string,
  method = 'GET',
  body?: unknown
): Promise<T> {
  const response = await fetch(`/api/admin${path}`, {
    method,
    cache: 'no-store',
    credentials: 'same-origin',
    headers: {
      'x-admin-access': accessCode,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let envelope: { success?: boolean; error?: string; data?: T };
  try {
    envelope = await response.json();
  } catch {
    throw new Error('The admin API is unavailable. Check that the backend is running.');
  }
  if (!response.ok || !envelope.success || envelope.data === undefined) {
    throw new Error(envelope.error || 'The request could not be completed.');
  }
  return envelope.data;
}

/** Fetch protected image bytes without putting the admin credential in an image URL. */
export async function adminBinaryRequest(accessCode: string, path: string): Promise<Blob> {
  const response = await fetch(`/api/admin${path}`, {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { 'x-admin-access': accessCode },
  });
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/'))
    throw new Error('The private artwork preview is unavailable.');
  return response.blob();
}
