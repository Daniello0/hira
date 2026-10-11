import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { LoginRequest, RegisterRequest } from '@hira/contracts';
import { UserRole } from '@hira/contracts';
import { normalizeDisplayNameInput, normalizeEmail } from '../auth-input';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../auth.constants';

/** Validated body of `POST /api/v1/auth/register`. */
export class RegisterBodyDto implements RegisterRequest {
  @ApiProperty({ type: String, example: 'ada@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  )
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ type: String, minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;

  @ApiPropertyOptional({ type: String, maxLength: 128 })
  @Transform(({ value }: { value: unknown }) => normalizeDisplayNameInput(value))
  @IsOptional()
  @IsString()
  @MaxLength(128)
  displayName?: string;
}

/** Validated body of `POST /api/v1/auth/login`. */
export class LoginBodyDto implements LoginRequest {
  @ApiProperty({ type: String, example: 'ada@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeEmail(value) : value,
  )
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({ type: String })
  @IsString()
  @MinLength(1)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;
}

/** Swagger shape of the access-token body. */
export class AuthSessionResponseDto {
  @ApiProperty({ type: String })
  accessToken!: string;

  @ApiProperty({ type: Number, example: 900 })
  expiresIn!: number;
}

/** Swagger shape of `GET /api/v1/auth/me`. */
export class CurrentUserResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  email!: string;

  @ApiProperty({ nullable: true, type: String })
  displayName!: string | null;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty({ type: Boolean })
  crossChatMemoryEnabled!: boolean;
}
