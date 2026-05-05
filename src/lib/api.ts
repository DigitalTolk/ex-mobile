import { apiUrl } from './url';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function messageFromResponse(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return response.statusText || `Request failed (${response.status})`;
  try {
    const data = JSON.parse(text) as { error?: string | { message?: string }; message?: string };
    if (typeof data.error === 'string') return data.error;
    if (data.error?.message) return data.error.message;
    if (data.message) return data.message;
  } catch {
    return text;
  }
  return text;
}

export async function apiFetch<T>(
  serverUrl: string,
  accessToken: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(apiUrl(serverUrl, path), {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new ApiError(response.status, await messageFromResponse(response));
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
