import type { ErrorRequestHandler } from 'express';

function getStatus(err: unknown): number {
  if (err && typeof err === 'object') {
    if ('status' in err && typeof err.status === 'number') return err.status;
    if ('statusCode' in err && typeof err.statusCode === 'number') {
      return err.statusCode;
    }
  }
  return 500;
}

function getMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

// global middlware 
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = getStatus(err);
  const isProd = process.env.NODE_ENV === 'production';
  const body =
    status >= 500 && isProd
      ? { error: 'Internal Server Error' }
      : { error: getMessage(err) };

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json(body);
};
