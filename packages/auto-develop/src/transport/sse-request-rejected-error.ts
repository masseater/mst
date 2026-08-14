export class SseRequestRejectedError extends Error {
  override readonly name = "SseRequestRejectedError";

  readonly code = "SSE_REQUEST_REJECTED";

  readonly category = "request-rejected";

  constructor() {
    super("the relay refused the SSE connection request");
  }
}
