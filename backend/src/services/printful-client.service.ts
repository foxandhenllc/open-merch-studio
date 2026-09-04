import axios, { type AxiosInstance } from 'axios';
import { env } from '../config/env.js';

/**
 * Builds the authenticated Printful transport used by the catalog, order, and mockup domains.
 *
 * Keeping credential and store scoping here prevents individual provider workflows from subtly
 * diverging in headers or timeout behavior. Callers still own their endpoint-specific payloads.
 */
export function createPrintfulClient(): AxiosInstance {
  if (!env.printfulApiKey) {
    throw new Error('PRINTFUL_API_KEY is not configured.');
  }

  return axios.create({
    baseURL: 'https://api.printful.com',
    headers: {
      Authorization: `Bearer ${env.printfulApiKey}`,
      'Content-Type': 'application/json',
      ...(env.printfulStoreId ? { 'X-PF-Store-Id': env.printfulStoreId } : {}),
    },
    timeout: 30000,
  });
}

/** Normalizes the v1/v2 response envelopes used across Printful endpoints. */
export function unwrapPrintfulResponse<T>(data: unknown): T {
  const response = data as { result?: T; data?: T };
  return (response?.result ?? response?.data ?? data) as T;
}

/**
 * Printful must fetch artwork itself, so loopback and non-HTTP locations are never provider-ready.
 */
export function isPublicHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const localHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);
    return ['http:', 'https:'].includes(url.protocol) && !localHosts.has(url.hostname);
  } catch {
    return false;
  }
}

/** Returns an operator-safe provider error without retaining request headers or payloads. */
export function describePrintfulError(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : 'Printful request failed.';
  }
  const data = error.response?.data as
    | { error?: { message?: string }; result?: string; message?: string }
    | string
    | undefined;
  const detail =
    typeof data === 'string'
      ? data
      : (data?.error?.message ?? data?.result ?? data?.message ?? error.message);
  return `Printful ${error.response?.status ?? 'request'}: ${detail}`;
}
