// 全局异常过滤器 — 统一错误响应格式
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@novel/shared';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = uuidv4();

    let httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'SYS_INTERNAL_ERROR';
    let message = '服务器内部错误，请稍后重试';
    let retryable = false;
    let detail: string | undefined;

    if (exception instanceof AppError) {
      httpStatus = exception.httpStatus;
      code = exception.code;
      message = exception.message;
      retryable = exception.retryable;
      detail = exception.detail;
    } else if (exception instanceof HttpException) {
      httpStatus = exception.getStatus();
      const exResponse = exception.getResponse();
      message =
        typeof exResponse === 'string'
          ? exResponse
          : (exResponse as any).message || exception.message;
      code = `HTTP_${httpStatus}`;
      retryable = httpStatus >= 500;
    } else if (exception instanceof Error) {
      detail = exception.message;
      this.logger.error(`未捕获异常: ${exception.message}`, exception.stack);
    }

    const errorResponse = {
      success: false as const,
      error: {
        code,
        message,
        detail: process.env.NODE_ENV === 'development' ? detail : undefined,
        requestId,
        timestamp: new Date().toISOString(),
        retryable,
      },
    };

    this.logger.error(
      `[${requestId}] ${request.method} ${request.url} → ${httpStatus} ${code}: ${message}`,
    );

    response.status(httpStatus).json(errorResponse);
  }
}
