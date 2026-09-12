export async function collectionPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || !data.success)
    throw Object.assign(
      new Error(data.error || 'The request could not be completed. Please retry.'),
      { code: data.errorCode }
    );
  return data.data;
}
