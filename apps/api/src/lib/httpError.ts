export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string, code?: string, details?: unknown) =>
  new HttpError(400, message, code, details);
export const unauthorized = (message = 'Unauthorized', code?: string) =>
  new HttpError(401, message, code);
export const forbidden = (message = 'Forbidden', code?: string) => new HttpError(403, message, code);
export const notFound = (message = 'Not found', code?: string) => new HttpError(404, message, code);
export const conflict = (message: string, code?: string) => new HttpError(409, message, code);
