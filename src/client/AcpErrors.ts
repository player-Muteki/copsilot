export class AcpTransportError extends Error {
  constructor(message: string, public override readonly cause?: Error) {
    super(message);
    this.name = 'AcpTransportError';
  }
}

export class AcpProtocolError extends Error {
  constructor(
    message: string,
    public readonly method: string,
    public readonly code?: number,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = 'AcpProtocolError';
  }
}

export class AcpTimeoutError extends AcpTransportError {
  constructor(public readonly method: string, public readonly timeoutMs: number) {
    super(`ACP request '${method}' timed out after ${timeoutMs}ms`);
    this.name = 'AcpTimeoutError';
  }
}

export class AcpProcessExitError extends AcpTransportError {
  constructor(public readonly exitCode: number | null, public readonly signal: string | null) {
    super(`ACP process exited (code=${exitCode}, signal=${signal})`);
    this.name = 'AcpProcessExitError';
  }
}
