import { INestApplication, RequestMethod, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { readWebOrigin } from './features/auth/auth.config';
import { REFRESH_COOKIE_NAME } from './features/auth/auth.constants';
import { validationException } from './features/auth/validation-exception';

/** Prefix, cookies, CORS, validation, and Swagger. Shared by `main` and HTTP tests. */
export function configureHttpApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1', { exclude: healthAndDocs() });
  app.use(cookieParser());
  app.enableCors({ origin: readWebOrigin(process.env), credentials: true });
  app.useGlobalPipes(validationPipe());
  setupSwagger(app);
}

function healthAndDocs(): Array<{ path: string; method: RequestMethod }> {
  return [
    { path: 'health', method: RequestMethod.ALL },
    { path: 'health/ready', method: RequestMethod.ALL },
    { path: 'docs', method: RequestMethod.ALL },
    { path: 'docs-json', method: RequestMethod.ALL },
    { path: 'docs/{*path}', method: RequestMethod.ALL },
  ];
}

function validationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: validationException,
  });
}

function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Hira core-api')
    .setDescription('External API. The refresh token is an httpOnly cookie.')
    .setVersion('1')
    .addBearerAuth()
    .addCookieAuth(REFRESH_COOKIE_NAME)
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
}
