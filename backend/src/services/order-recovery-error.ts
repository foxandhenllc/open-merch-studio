export class OrderRecoveryError extends Error {
  statusCode: number;
  errorCode: string;

  constructor(message: string, statusCode = 409, errorCode = 'order_recovery_blocked') {
    super(message);
    this.name = 'OrderRecoveryError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}
