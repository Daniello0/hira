/** Email and password do not match, or the email is unknown. The message is the same in both cases. */
export class InvalidCredentialsError extends Error {
  constructor() {
    super('Email or password is incorrect');
    this.name = 'InvalidCredentialsError';
  }
}

/** Presented refresh token is missing, unknown, or expired. */
export class RefreshInvalidError extends Error {
  constructor() {
    super('Refresh token is invalid');
    this.name = 'RefreshInvalidError';
  }
}

/** A revoked refresh token was presented again. The user's other sessions are revoked with it. */
export class RefreshReusedError extends Error {
  constructor() {
    super('Refresh token was reused');
    this.name = 'RefreshReusedError';
  }
}

/** Missing or rejected access token, or the account no longer exists. */
export class UnauthorizedError extends Error {
  constructor() {
    super('Authentication is required');
    this.name = 'UnauthorizedError';
  }
}

/** Login attempts exceeded the per-minute allowance. */
export class LoginLimitedError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('Too many login attempts');
    this.name = 'LoginLimitedError';
  }
}
