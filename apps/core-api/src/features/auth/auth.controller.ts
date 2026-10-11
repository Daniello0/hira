import type { AuthSessionDto, CurrentUserDto } from '@hira/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { readAuth, AccessTokenGuard } from './access-token.guard';
import {
  clearRefreshCookie,
  clientMeta,
  mapAuthError,
  readRefreshCookie,
  sessionBody,
  setRefreshCookie,
} from './auth-http';
import { AuthService } from './auth.service';
import {
  AuthSessionResponseDto,
  CurrentUserResponseDto,
  LoginBodyDto,
  RegisterBodyDto,
} from './dto/auth.dto';
import { REFRESH_COOKIE_NAME } from './auth.constants';
import { validatedBody } from './validation-exception';

/** Register, login, refresh, logout, and the current user. */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  /** Creates an account and sets the refresh cookie. */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register and start a session' })
  @ApiCreatedResponse({ type: AuthSessionResponseDto })
  async register(
    @Body(validatedBody(RegisterBodyDto)) body: RegisterBodyDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionDto> {
    const session = await this.call(
      () => this.authService.register(body, clientMeta(request)),
      request,
    );
    setRefreshCookie(response, session.refreshToken);
    return sessionBody(session);
  }

  /** Checks the password and sets a new refresh cookie. */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in' })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  async login(
    @Body(validatedBody(LoginBodyDto)) body: LoginBodyDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionDto> {
    const session = await this.call(
      () => this.authService.login(body, clientMeta(request)),
      request,
    );
    setRefreshCookie(response, session.refreshToken);
    return sessionBody(session);
  }

  /** Rotates the refresh cookie. A bad cookie is cleared. */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_COOKIE_NAME)
  @ApiOperation({ summary: 'Rotate the refresh token' })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionDto> {
    try {
      const session = await this.authService.refresh(
        readRefreshCookie(request),
        clientMeta(request),
      );
      setRefreshCookie(response, session.refreshToken);
      return sessionBody(session);
    } catch (error) {
      clearRefreshCookie(response);
      this.rethrow(error, request);
    }
  }

  /** Revokes the refresh cookie. Logout of an already revoked token is not reuse. */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth(REFRESH_COOKIE_NAME)
  @ApiOperation({ summary: 'Revoke the refresh token' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    try {
      await this.authService.logout(readRefreshCookie(request));
    } catch (error) {
      this.rethrow(error, request);
    } finally {
      clearRefreshCookie(response);
    }
  }

  /** Returns the account for the bearer token. */
  @Get('me')
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current user' })
  @ApiOkResponse({ type: CurrentUserResponseDto })
  me(@Req() request: Request): Promise<CurrentUserDto> {
    return this.call(() => this.authService.me(readAuth(request).userId), request);
  }

  private async call<T>(action: () => Promise<T>, request: Request): Promise<T> {
    try {
      return await action();
    } catch (error) {
      this.rethrow(error, request);
    }
  }

  private rethrow(error: unknown, request: Request): never {
    const http = mapAuthError(error, request);
    if (http !== null) throw http;
    throw error;
  }
}
