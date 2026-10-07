export class AppError extends Error {
  constructor(public stage: string, public code: string, message: string, public httpStatus = 400) { super(message); }
}
export function applicationError(error: unknown): AppError {
  return error instanceof AppError ? error : new AppError('server', 'INTERNAL_ERROR', 'The server could not complete this step. No successful payment is assumed.', 500);
}
