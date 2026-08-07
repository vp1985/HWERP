export type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface FrappeClientOptions {
  baseUrl?: string;
  fetchImpl?: FetchLike;
}

export type FrappeErrorKind =
  | 'csrf'
  | 'network'
  | 'authentication'
  | 'authorization'
  | 'validation'
  | 'conflict'
  | 'server'
  | 'protocol';

export interface FrappeClientErrorOptions {
  kind: FrappeErrorKind;
  code: string;
  message: string;
  status?: number;
  retryable?: boolean;
  details?: unknown;
  requestId?: string;
  cause?: unknown;
}

export class FrappeClientError extends Error {
  readonly kind: FrappeErrorKind;
  readonly code: string;
  readonly status?: number;
  readonly retryable: boolean;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(options: FrappeClientErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = 'FrappeClientError';
    this.kind = options.kind;
    this.code = options.code;
    this.status = options.status;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
    this.requestId = options.requestId;
  }
}

export interface FrappeWriteOptions {
  conflictToken?: string;
  idempotencyKey?: string;
}

export interface FrappeClient {
  get<TResult>(path: string): Promise<TResult>;
  post<TResult, TBody>(
    path: string,
    body: TBody,
    options?: FrappeWriteOptions,
  ): Promise<TResult>;
  setCsrfToken(token: string | null): void;
}

interface FrappeSuccessEnvelope<TResult> {
  message: TResult;
}

type FrappeErrorPayload = Record<string, unknown> & {
  exc_type?: unknown;
  exception?: unknown;
  _server_messages?: unknown;
};

function firstServerMessage(payload: FrappeErrorPayload): string | undefined {
  if (typeof payload._server_messages !== 'string') return undefined;

  try {
    const encodedMessages = JSON.parse(payload._server_messages) as unknown;
    if (!Array.isArray(encodedMessages)) return undefined;

    for (const encodedMessage of encodedMessages) {
      if (typeof encodedMessage !== 'string') continue;
      try {
        const decoded = JSON.parse(encodedMessage) as { message?: unknown };
        if (typeof decoded.message === 'string' && decoded.message.trim()) {
          return decoded.message;
        }
      } catch {
        if (encodedMessage.trim()) return encodedMessage;
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function httpError(response: Response, payload: FrappeErrorPayload): FrappeClientError {
  const kind: FrappeErrorKind = response.status === 401
    ? 'authentication'
    : response.status === 403
      ? 'authorization'
      : [400, 417, 422].includes(response.status)
        ? 'validation'
        : 'server';
  const code = typeof payload.exc_type === 'string'
    ? payload.exc_type
    : `http_${response.status}`;
  const exceptionMessage = typeof payload.exception === 'string'
    ? payload.exception.replace(/^.*?:\s*/, '')
    : undefined;

  return new FrappeClientError({
    kind,
    code,
    message: firstServerMessage(payload)
      ?? exceptionMessage
      ?? `Frappe-Anfrage fehlgeschlagen (HTTP ${response.status}).`,
    status: response.status,
    details: payload,
    retryable: response.status === 429 || response.status >= 500,
    requestId: response.headers.get('X-Request-ID') ?? undefined,
  });
}

function conflictError(response: Response, payload: FrappeErrorPayload): FrappeClientError {
  const code = typeof payload.exc_type === 'string'
    ? payload.exc_type
    : `http_${response.status}`;
  const fallback = typeof payload.exception === 'string'
    ? payload.exception
    : 'Die Kalkulation wurde zwischenzeitlich geändert.';

  return new FrappeClientError({
    kind: 'conflict',
    code,
    message: firstServerMessage(payload) ?? fallback,
    status: response.status,
    details: payload,
    requestId: response.headers.get('X-Request-ID') ?? undefined,
  });
}

function joinUrl(baseUrl: string, path: string): string {
  if (!baseUrl) return path;
  return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

export function createFrappeClient(options: FrappeClientOptions = {}): FrappeClient {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const baseUrl = options.baseUrl ?? '';
  let csrfToken: string | null = null;

  async function performFetch(path: string, init: RequestInit): Promise<Response> {
    try {
      return await fetchImpl(joinUrl(baseUrl, path), init);
    } catch (cause) {
      throw new FrappeClientError({
        kind: 'network',
        code: 'network_error',
        message: 'ERPNext/Frappe ist nicht erreichbar.',
        retryable: true,
        cause,
      });
    }
  }

  async function readMessage<TResult>(response: Response): Promise<TResult> {
    let payload: FrappeSuccessEnvelope<TResult> | FrappeErrorPayload;
    try {
      payload = await response.json() as FrappeSuccessEnvelope<TResult> | FrappeErrorPayload;
    } catch (cause) {
      throw new FrappeClientError({
        kind: 'protocol',
        code: 'invalid_json_response',
        message: 'Frappe hat keine gültige JSON-Antwort geliefert.',
        status: response.status,
        retryable: response.status >= 500,
        requestId: response.headers.get('X-Request-ID') ?? undefined,
        cause,
      });
    }
    if (!response.ok) {
      if (response.status === 409 || response.status === 412) {
        throw conflictError(response, payload as FrappeErrorPayload);
      }
      throw httpError(response, payload as FrappeErrorPayload);
    }
    return (payload as FrappeSuccessEnvelope<TResult>).message;
  }

  return {
    async get<TResult>(path: string): Promise<TResult> {
      const response = await performFetch(path, {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      return readMessage<TResult>(response);
    },

    async post<TResult, TBody>(
      path: string,
      body: TBody,
      writeOptions: FrappeWriteOptions = {},
    ): Promise<TResult> {
      if (!csrfToken) {
        throw new FrappeClientError({
          kind: 'csrf',
          code: 'csrf_token_missing',
          message: 'Für die Schreibanfrage ist kein CSRF-Token der aktuellen Frappe-Sitzung verfügbar.',
        });
      }

      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      };
      if (csrfToken) headers['X-Frappe-CSRF-Token'] = csrfToken;
      if (writeOptions.conflictToken) headers['If-Match'] = writeOptions.conflictToken;
      if (writeOptions.idempotencyKey) headers['Idempotency-Key'] = writeOptions.idempotencyKey;

      const response = await performFetch(path, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(body),
      });
      return readMessage<TResult>(response);
    },

    setCsrfToken(token: string | null): void {
      csrfToken = token;
    },
  };
}
