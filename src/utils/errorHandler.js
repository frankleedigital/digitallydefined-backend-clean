// src/utils/errorHandler.js
// ============================================================================
// Centralized Error Handling
// ============================================================================
// Purpose: Standardized error responses and error classes.
// ============================================================================

/** Application Error class with status code and optional metadata. */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not Found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too Many Requests', retryAfter = 60) {
    super(message, 429, 'RATE_LIMIT', { retryAfter });
    this.name = 'RateLimitError';
  }
}

export class ExternalError extends AppError {
  constructor(message = 'External service error', provider = null) {
    super(message, 502, 'EXTERNAL_ERROR', { provider });
    this.name = 'ExternalError';
  }
}

/** Create a standardized JSON error response. */
export function errorResponse(res, error, showDetails = false) {
  const statusCode = error.statusCode || 500;
  const code = error.code || 'INTERNAL_ERROR';
  const message = error.message || 'An unexpected error occurred';

  const body = {
    error: {
      code,
      message,
    },
  };

  if (showDetails && process.env.NODE_ENV !== 'production') {
    body.error.details = error.details || null;
    body.error.stack = process.env.NODE_ENV !== 'production' ? error.stack || null : undefined;
  }

  return res.status(statusCode).json(body);
}

/** Express error handling middleware. Usage: app.use(errorHandler) */
export function errorHandler(err, req, res, next) {
  console.error('Unhandled error:', err);

  if (err instanceof AppError) {
    return errorResponse(res, err, process.env.NODE_ENV !== 'production');
  }

  if (err.name === 'ZodError') {
    return errorResponse(
      res,
      new ValidationError('Input validation failed', err.errors),
      process.env.NODE_ENV !== 'production'
    );
  }

  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'An internal error occurred'
    : err.message || 'Unknown error';

  res.status(statusCode).json({
    error: {
      code: 'INTERNAL_ERROR',
      message,
    },
  });
}

export default {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  ExternalError,
  errorResponse,
  errorHandler,
};