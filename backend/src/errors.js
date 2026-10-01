export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function badRequest(message) {
  return new HttpError(400, 'BAD_REQUEST', message);
}

export function unauthorized(message = 'Authentication required.') {
  return new HttpError(401, 'UNAUTHORIZED', message);
}

export function forbidden(message = 'You do not have permission to access this resource.') {
  return new HttpError(403, 'FORBIDDEN', message);
}

export function notFound(message = 'Resource not found.') {
  return new HttpError(404, 'NOT_FOUND', message);
}

export function tooManyRequests(message = 'Too many requests. Please try again shortly.') {
  return new HttpError(429, 'RATE_LIMITED', message);
}
