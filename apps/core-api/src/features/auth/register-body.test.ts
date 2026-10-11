import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { validationException } from './validation-exception';
import { RegisterBodyDto } from './dto/auth.dto';

describe('register body validation', () => {
  it('rejects a role field', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationException,
    });
    await expect(
      pipe.transform(
        { email: 'ada@example.com', password: 'correct-horse', role: 'ADMIN' },
        { type: 'body', metatype: RegisterBodyDto },
      ),
    ).rejects.toThrow();
  });
});
