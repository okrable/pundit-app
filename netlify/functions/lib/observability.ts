export interface LogContext {
  endpoint: string;
  requestId: string;
  userId?: string;
}

export function createRequestId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function logRequestStart(context: LogContext) {
  console.info('[api.request.start]', JSON.stringify(context));
}

export function logRequestEnd(context: LogContext, durationMs: number, statusCode: number) {
  console.info(
    '[api.request.end]',
    JSON.stringify({
      ...context,
      durationMs,
      statusCode,
    })
  );
}

export function logRequestError(context: LogContext, durationMs: number, error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(
    '[api.request.error]',
    JSON.stringify({
      ...context,
      durationMs,
      error: errorMessage,
    })
  );
}
