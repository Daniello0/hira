'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { coreFetch } from '../../common/api/core-api';
import { Button } from '../../common/components/button';
import { AlertText } from '../../common/components/feedback';
import { HiraLogo } from '../../common/components/logo';
import { TextField } from '../../common/components/text-field';
import { COULD_NOT_REACH } from './auth.constants';
import { loginSchema } from './auth.schema';
import { readApiMessage } from './read-api-message';
import { loadMe } from './session';
import { useSession } from './session.store';

interface LoginValues {
  email: string;
  password: string;
}

/** Sign-in form. The access token stays in this tab. */
export function LoginForm() {
  const router = useRouter();
  const setAccount = useSession((state) => state.setAccount);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const form = useForm<LoginValues>({ resolver: yupResolver(loginSchema) });
  return (
    <form
      className="motion-enter mx-auto flex min-h-dvh w-full max-w-form flex-col justify-center gap-4 px-6 py-8"
      onSubmit={form.handleSubmit(
        (values) => void submitLogin(values, setAccount, setError, setPending, router),
      )}
    >
      <div className="flex flex-col items-center gap-4 pb-2"><HiraLogo className="size-control" /><h1 className="text-center text-3xl font-normal">Sign in</h1></div>
      <TextField label="Email" type="email" autoComplete="email" {...form.register('email')} />
      <TextField
        label="Password"
        type="password"
        autoComplete="current-password"
        {...form.register('password')}
      />
      {form.formState.errors.password ? <AlertText>{form.formState.errors.password.message}</AlertText> : null}
      {error !== null ? <AlertText>{error}</AlertText> : null}
      <Button type="submit" disabled={pending}>
        Sign in
      </Button>
      <Link className="text-center text-sm text-link transition-colors hover:text-link-hover" href="/register">
        Create an account
      </Link>
    </form>
  );
}

async function submitLogin(
  values: LoginValues,
  setAccount: ReturnType<typeof useSession.getState>['setAccount'],
  setError: (value: string | null) => void,
  setPending: (value: boolean) => void,
  router: ReturnType<typeof useRouter>,
): Promise<void> {
  setPending(true);
  try {
    const response = await coreFetch('/api/v1/auth/login', jsonBody(values), null);
    if (!response.ok) {
      setError(await readApiMessage(response, 'Sign-in failed'));
      return;
    }
    await enter(await response.json(), setAccount, setError, router);
  } catch {
    setError(COULD_NOT_REACH);
  } finally {
    setPending(false);
  }
}

async function enter(
  body: unknown,
  setAccount: ReturnType<typeof useSession.getState>['setAccount'],
  setError: (value: string | null) => void,
  router: ReturnType<typeof useRouter>,
): Promise<void> {
  if (!isGrant(body)) {
    setError('Could not start the session');
    return;
  }
  const user = await loadMe(body.accessToken);
  if (user === null) {
    setError('Could not load the account');
    return;
  }
  setAccount(
    { accessToken: body.accessToken, expiresAt: Date.now() + body.expiresIn * 1000 },
    user,
  );
  router.push('/chat');
}

function isGrant(body: unknown): body is { accessToken: string; expiresIn: number } {
  return typeof body === 'object' && body !== null && 'accessToken' in body && 'expiresIn' in body;
}

function jsonBody(values: LoginValues): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  };
}
