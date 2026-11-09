import type { AdminSettings, Post } from './domain';

const localDockerApiUrl = typeof window !== 'undefined'
  && ['localhost', '127.0.0.1'].includes(window.location.hostname)
  && window.location.port === '9005'
  ? `${window.location.protocol}//${window.location.hostname}:8018`
  : '';

export const apiUrl = import.meta.env.VITE_API_URL || localDockerApiUrl || (import.meta.env.DEV ? 'http://localhost:4000' : '');
export const assetUrl = (path?: string | null) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${apiUrl}${path.startsWith('/') ? path : `/${path}`}`;
};

async function parseData<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Request failed. Please try again.');
  if (!(body && Object.prototype.hasOwnProperty.call(body, 'data'))) throw new Error('The API returned an invalid response.');
  return body.data;
}

export async function getPosts(): Promise<Post[]> {
  return parseData<Post[]>(await fetch(`${apiUrl}/api/posts`));
}

export async function getPost(slug: string): Promise<Post> {
  return parseData<Post>(await fetch(`${apiUrl}/api/posts/${slug}`));
}

export async function subscribe(email: string) {
  return parseData<{ email: string }>(
    await fetch(`${apiUrl}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }),
  );
}

export async function unsubscribe(email: string) {
  return parseData<{ ok: boolean }>(
    await fetch(`${apiUrl}/api/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }),
  );
}

export type BookOffer = { title: string; price: string; currency: string };
export type BookOrderStatus = { status: 'pending' | 'paid'; downloadUrl?: string };

export async function getBookOffer(): Promise<BookOffer> {
  return parseData<BookOffer>(await fetch(`${apiUrl}/api/book`));
}

export async function createBookCheckout(): Promise<{ checkoutUrl: string }> {
  return parseData<{ checkoutUrl: string }>(await fetch(`${apiUrl}/api/book/checkout`, { method: 'POST' }));
}

export async function getBookOrderStatus(sessionId: string): Promise<BookOrderStatus> {
  return parseData<BookOrderStatus>(await fetch(`${apiUrl}/api/book/order/${encodeURIComponent(sessionId)}`));
}

export async function request<T>(path: string, options: RequestInit = {}, token?: string, csrfToken?: string): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (csrfToken) headers.set('x-csrf-token', csrfToken);
  return parseData<T>(
    await fetch(`${apiUrl}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    }),
  );
}

export type { AdminSettings, Post };
