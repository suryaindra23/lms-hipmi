import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { ObservabilityService } from './observability.service';

@Injectable()
export class RequestMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: ObservabilityService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const started = performance.now();
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const route = String(request.originalUrl || request.url || '/').split('?')[0];
    let recorded = false;
    const record = (status: number) => {
      if (recorded) return;
      recorded = true;
      const durationMs = performance.now() - started;
      this.metrics.recordHttp(status, durationMs, route);
      const entry = {
        level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
        event: 'http_request',
        requestId: request.requestId,
        method: request.method,
        route,
        status,
        durationMs: Math.round(durationMs * 10) / 10,
        actorId: request.user?.userId,
        organizationId: request.user?.organizationId,
        schoolId: request.user?.schoolId,
      };
      console.log(JSON.stringify(entry));
    };
    return next.handle().pipe(
      tap(() => record(response.statusCode || 200)),
      catchError((error) => {
        record(error instanceof HttpException ? error.getStatus() : 500);
        return throwError(() => error);
      }),
    );
  }
}
