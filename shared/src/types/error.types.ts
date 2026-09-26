// 错误类型定义

import type { ErrorCode } from '../constants/error-codes';

/** 业务错误类 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly retryable: boolean;
  public readonly detail?: string;

  constructor(
    code: ErrorCode,
    message: string,
    httpStatus = 400,
    retryable = false,
    detail?: string,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.retryable = retryable;
    this.detail = detail;
  }
}
