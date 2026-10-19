import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogService } from '../services/audit-log.service';
import { auditFieldSummary } from '../utils/security.utils';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, originalUrl, url, body, ip, user } = request;
    const requestUrl = originalUrl || url;
    const userAgent = request.get('user-agent')?.slice(0, 500);

    // Hanya log method yang mengubah data
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: (response) => this.writeAudit(request, {
          outcome: 'SUCCESS',
          responseId: response?.id || response?.user?.id,
          requestUrl,
          body,
          ip,
          user,
          userAgent,
        }),
        error: (error) => this.writeAudit(request, {
          outcome: 'FAILURE',
          statusCode: typeof error?.getStatus === 'function' ? error.getStatus() : 500,
          requestUrl,
          body,
          ip,
          user,
          userAgent,
        }),
      }),
    );
  }

  private writeAudit(request: any, data: any) {
    const action = request.method === 'POST' ? 'CREATE' : request.method === 'DELETE' ? 'DELETE' : 'UPDATE';
    const resource = resourceFromUrl(data.requestUrl);
    void this.auditLogService.log({
      actorId: data.user?.userId,
      userId: resource === 'auth' ? data.responseId : undefined,
      organizationId: data.user?.organizationId,
      schoolId: data.user?.schoolId,
      action,
      resource,
      resourceId: data.responseId || data.body?.id || request.params?.id,
      details: {
        route: String(data.requestUrl).split('?')[0],
        request: auditFieldSummary(data.body),
        outcome: data.outcome,
        ...(data.statusCode ? { statusCode: data.statusCode } : {}),
      },
      ipAddress: data.ip,
      userAgent: data.userAgent,
      correlationId: request.requestId,
    });
  }
}

export function resourceFromUrl(url: string) {
  const parts = String(url).split('?')[0].split('/').filter(Boolean);
  const versionIndex = parts.findIndex((part) => /^v\d+$/.test(part));
  return parts[versionIndex >= 0 ? versionIndex + 1 : 0] || 'unknown';
}
