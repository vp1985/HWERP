import { describe, expect, it, vi } from 'vitest';

import { createFrappeClient, FrappeClientError } from './frappeClient';

describe('FrappeClient', () => {
  it('uses the current browser session and unwraps a typed Frappe message', async () => {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({ message: { user: 'max@example.test' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));
    const client = createFrappeClient({
      baseUrl: 'https://erp.example.test',
      fetchImpl,
    });

    const result = await client.get<{ user: string }>(
      '/api/method/hwerp.api.v1.calculations.session_context',
    );

    expect(result).toEqual({ user: 'max@example.test' });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://erp.example.test/api/method/hwerp.api.v1.calculations.session_context',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
        headers: expect.objectContaining({ Accept: 'application/json' }),
      }),
    );
  });

  it('protects a mutating request with CSRF, session, idempotency and conflict headers', async () => {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({ message: { conflict_token: 'v2' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));
    const client = createFrappeClient({ fetchImpl });
    client.setCsrfToken('csrf-session-token');

    const result = await client.post<{ conflict_token: string }, { title: string }>(
      '/api/method/hwerp.api.v1.calculations.save',
      { title: 'Revision Trafo' },
      { conflictToken: 'v1', idempotencyKey: 'save-123' },
    );

    expect(result).toEqual({ conflict_token: 'v2' });
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/method/hwerp.api.v1.calculations.save',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ title: 'Revision Trafo' }),
        headers: expect.objectContaining({
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Frappe-CSRF-Token': 'csrf-session-token',
          'If-Match': 'v1',
          'Idempotency-Key': 'save-123',
        }),
      }),
    );
  });

  it('blocks unsafe requests locally when no CSRF token is available', async () => {
    const fetchImpl = vi.fn();
    const client = createFrappeClient({ fetchImpl });

    const request = client.post('/api/method/hwerp.api.v1.calculations.save', {});

    await expect(request).rejects.toMatchObject({
      name: 'FrappeClientError',
      kind: 'csrf',
      code: 'csrf_token_missing',
      retryable: false,
    } satisfies Partial<FrappeClientError>);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('turns a Frappe version mismatch into a structured conflict error', async () => {
    const serverMessages = JSON.stringify([
      JSON.stringify({ message: 'Die Kalkulation wurde zwischenzeitlich geändert.' }),
    ]);
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({
        exc_type: 'TimestampMismatchError',
        _server_messages: serverMessages,
        conflict_token: 'server-v2',
        current: { name: 'KALK-0001' },
      }),
      {
        status: 409,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': 'req-42',
        },
      },
    ));
    const client = createFrappeClient({ fetchImpl });
    client.setCsrfToken('csrf-token');

    const request = client.post(
      '/api/method/hwerp.api.v1.calculations.save',
      { calculation: {} },
      { conflictToken: 'client-v1' },
    );

    await expect(request).rejects.toMatchObject({
      name: 'FrappeClientError',
      kind: 'conflict',
      code: 'TimestampMismatchError',
      status: 409,
      message: 'Die Kalkulation wurde zwischenzeitlich geändert.',
      retryable: false,
      requestId: 'req-42',
      details: expect.objectContaining({ conflict_token: 'server-v2' }),
    } satisfies Partial<FrappeClientError>);
  });

  it.each([
    [401, 'AuthenticationError', 'authentication'],
    [403, 'PermissionError', 'authorization'],
    [422, 'ValidationError', 'validation'],
  ] as const)('classifies HTTP %i as a structured %s error', async (status, code, kind) => {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({ exc_type: code, exception: `frappe.exceptions.${code}: Nicht erlaubt` }),
      { status, headers: { 'Content-Type': 'application/json' } },
    ));
    const client = createFrappeClient({ fetchImpl });

    await expect(client.get('/api/method/hwerp.api.v1.calculations.session_context'))
      .rejects.toMatchObject({
        name: 'FrappeClientError',
        kind,
        code,
        status,
        retryable: false,
      } satisfies Partial<FrappeClientError>);
  });

  it('normalizes transport failures without inventing a server response', async () => {
    const cause = new TypeError('Failed to fetch');
    const client = createFrappeClient({
      fetchImpl: vi.fn(async () => { throw cause; }),
    });

    await expect(client.get('/api/method/hwerp.api.v1.calculations.session_context'))
      .rejects.toMatchObject({
        name: 'FrappeClientError',
        kind: 'network',
        code: 'network_error',
        retryable: true,
        status: undefined,
        cause,
      });
  });

  it('reports non-JSON gateway responses as protocol errors', async () => {
    const client = createFrappeClient({
      fetchImpl: vi.fn(async () => new Response('<html>Bad gateway</html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      })),
    });

    await expect(client.get('/api/method/hwerp.api.v1.calculations.session_context'))
      .rejects.toMatchObject({
        name: 'FrappeClientError',
        kind: 'protocol',
        code: 'invalid_json_response',
        status: 502,
        retryable: true,
      } satisfies Partial<FrappeClientError>);
  });
});
