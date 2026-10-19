import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { SchoolsModule } from './schools/schools.module';
import { StudentsModule } from './students/students.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { AffiliateModule } from './affiliate/affiliate.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { IdentityDocumentsModule } from './identity/identity.module';
import { LeadsModule } from './leads/leads.module';
import { AuditLogService } from './common/services/audit-log.service';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { HealthController } from './health.controller';
import { LearningModule } from './learning/learning.module';
import { MasterDataModule } from './master-data/master-data.module';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { InvitationsModule } from './invitations/invitations.module';
import { ImportsModule } from './imports/imports.module';
import { PrivacyModule } from './privacy/privacy.module';
import { RubricsModule } from './rubrics/rubrics.module';
import { StudentStoreModule } from './student-store/student-store.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { SupportingModule } from './supporting/supporting.module';
import { ObservabilityModule } from './observability/observability.module';
import { RequestMetricsInterceptor } from './observability/request-metrics.interceptor';
import { AccessModule } from './access/access.module';
import { CommerceModule } from './commerce/commerce.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    SchoolsModule,
    StudentsModule,
    AssignmentsModule,
    SubmissionsModule,
    AffiliateModule,
    DashboardModule,
    IdentityDocumentsModule,
    LeadsModule,
    LearningModule,
    MasterDataModule,
    InfrastructureModule,
    InvitationsModule,
    ImportsModule,
    PrivacyModule,
    RubricsModule,
    StudentStoreModule,
    MonitoringModule,
    SupportingModule,
    ObservabilityModule,
    AccessModule,
    CommerceModule,
  ],
  controllers: [HealthController],
  providers: [
    AuditLogService,
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestMetricsInterceptor,
    },
  ],
})
export class AppModule {}
