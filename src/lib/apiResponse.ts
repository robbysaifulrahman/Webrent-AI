import { getRequestId, newRequestId } from "./requestId";

export interface ApiMeta {
  request_id: string;
  timestamp: string;
}

export interface ApiEnvelope<T> {
  success: true;
  data: T;
  meta: ApiMeta;
}

export interface ApiErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
  };
  meta: ApiMeta;
}

const NO_STORE = { "Cache-Control": "no-store" } as const;

function meta(requestId?: string): ApiMeta {
  return {
    request_id: requestId ?? newRequestId(),
    timestamp: new Date().toISOString(),
  };
}

/** Respons sukses ber-envelope: { success, data, meta.request_id }. */
export function jsonOk<T>(
  data: T,
  opts: { req?: Request; requestId?: string; status?: number; headers?: Record<string, string> } = {},
): Response {
  const requestId = opts.requestId ?? (opts.req ? getRequestId(opts.req) : newRequestId());
  const body: ApiEnvelope<T> = {
    success: true,
    data,
    meta: meta(requestId),
  };
  return Response.json(body, {
    status: opts.status ?? 200,
    headers: {
      ...NO_STORE,
      "X-Request-Id": requestId,
      ...opts.headers,
    },
  });
}

/** Respons error ber-envelope dengan kode mesin yang stabil. */
export function jsonError(
  code: string,
  message: string,
  status: number,
  opts: { req?: Request; headers?: Record<string, string> } = {},
): Response {
  const requestId = opts.req ? getRequestId(opts.req) : newRequestId();
  const body: ApiErrorEnvelope = {
    success: false,
    error: { code, message },
    meta: meta(requestId),
  };
  return Response.json(body, {
    status,
    headers: {
      ...NO_STORE,
      "X-Request-Id": requestId,
      ...opts.headers,
    },
  });
}
