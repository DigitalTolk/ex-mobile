import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from './api';

describe('apiFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('sends bearer auth, JSON content type, and parses JSON responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      apiFetch('https://chat.example.com', 'token-1', '/api/v1/messages', {
        method: 'POST',
        body: JSON.stringify({ body: 'hello' }),
      }),
    ).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://chat.example.com/api/v1/messages',
      expect.objectContaining({
        credentials: 'include',
        method: 'POST',
      }),
    );
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer token-1');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('preserves caller content type and returns undefined for no-content responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      apiFetch('https://chat.example.com', 'token-1', '/api/v1/upload', {
        body: 'raw',
        headers: { 'Content-Type': 'text/plain' },
      }),
    ).resolves.toBeUndefined();

    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Content-Type')).toBe('text/plain');
  });

  it('does not add a content type when there is no string body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('https://chat.example.com', 'token-1', '/api/v1/messages')).resolves.toEqual({ ok: true });

    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.has('Content-Type')).toBe(false);
  });

  it.each([
    ['string error', JSON.stringify({ error: 'bad request' }), 'bad request'],
    ['object error', JSON.stringify({ error: { message: 'expired' } }), 'expired'],
    ['message field', JSON.stringify({ message: 'missing' }), 'missing'],
    ['unrecognized JSON', JSON.stringify({ detail: 'unknown' }), '{"detail":"unknown"}'],
    ['plain text', 'nope', 'nope'],
    ['empty body', '', 'Bad Request'],
    ['empty status text', '', 'Request failed (400)'],
  ])('throws ApiError from %s responses', async (_name, body, message) => {
    const statusText = _name === 'empty status text' ? '' : 'Bad Request';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 400, statusText })));

    await expect(apiFetch('https://chat.example.com', 'token-1', '/api/v1/fail')).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message,
    } satisfies Partial<ApiError>);
  });
});
