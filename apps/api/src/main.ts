import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { assertProductionSecrets } from './common/utils/security.utils';
import helmet from 'helmet';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  assertProductionSecrets(process.env);
  const app = await NestFactory.create(AppModule);
  if (process.env.TRUST_PROXY && process.env.TRUST_PROXY !== 'false') {
    app.getHttpAdapter().getInstance().set('trust proxy', process.env.TRUST_PROXY);
  }

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use((request: any, response: any, next: () => void) => {
    const requestId = request.get('x-request-id')?.slice(0, 128) || randomUUID();
    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    next();
  });

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  // CORS
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3001')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_API_DOCS === 'true') {
    const openApiConfig = new DocumentBuilder()
      .setTitle('Sunrise Academy API')
      .setDescription('API multi-sekolah untuk LMS, submission, review, dan monitoring.')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, openApiConfig);
    SwaggerModule.setup('api/docs', app, document, { jsonDocumentUrl: 'api/docs/openapi.json' });
  }

  app.enableShutdownHooks();

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}/api/v1`);
}
bootstrap();
