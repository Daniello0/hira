'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { coreFetch } from '../../common/api/core-api';
import { Button } from '../../common/components/button';
import { TextField } from '../../common/components/text-field';
import { loginSchema } from './auth.schema';
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
  const form = useForm<LoginValues>({ resolver: yupResolver(loginSchema) });
  return (
    <form className="mx-auto flex w-full max-w-sm flex-col gap-4 p-8" onSubmit={form.handleSubmit((values) => void submitLogin(values, setAccount, setError, router))}>
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <TextField label="Email" type="email" autoComplete="email" {...form.register('email')} />
      <TextField label="Password" type="password" autoComplete="current-password" {...form.register('password')} />
      {form.formState.errors.password ? <p>{form.formState.errors.password.message}</p> : null}
      {error !== null ? <p>{error}</p> : null}
      <Button type="submit">Sign in</Button>
      <Link className="text-sm text-hira-accent" href="/register">Create an account</Link>
    </form>
  );
}

async function submitLogin(
  values: LoginValues,
  setAccount: ReturnType<typeof useSession.getState>['setAccount'],
  setError: (value: string | null) => void,
  router: ReturnType<typeof useRouter>,
): Promise<void> {
  const response = await coreFetch('/api/v1/auth/login', jsonBody(values), null);
  if (!response.ok) {
    setError(await errorMessage(response));
    return;
  }
  await enter(await response.json(), setAccount, setError, router);
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
  setAccount({ accessToken: body.accessToken, expiresAt: Date.now() + body.expiresIn * 1000 }, user);
  router.push('/chat');
}

function isGrant(body: unknown): body is { accessToken: string; expiresIn: number } {
  return typeof body === 'object' && body !== null && 'accessToken' in body && 'expiresIn' in body;
}

async function errorMessage(response: Response): Promise<string> {
  const body = (await response.json()) as { message?: string };
  return body.message ?? 'Sign-in failed';
}

function jsonBody(values: LoginValues): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) };
}
