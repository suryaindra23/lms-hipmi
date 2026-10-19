import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest();
    const response = context.getResponse();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exception.getResponse() : undefined;
    const rawMessage = typeof payload === 'string' ? payload : (payload as any)?.message;
    const message =
      status >= 500
        ? 'Terjadi gangguan pada layanan. Silakan coba kembali.'
        : rawMessage || 'Permintaan tidak dapat diproses';

    response.status(status).json({
      statusCode: status,
      message,
      error: status >= 500 ? 'Internal Server Error' : (payload as any)?.error,
      requestId: request.requestId,
      timestamp: new Date().toISOString(),
      path: request.originalUrl || request.url,
    });
  }
}
