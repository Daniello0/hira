'use client';

import { yupResolver } from '@hookform/resolvers/yup';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { coreFetch } from '../../common/api/core-api';
import { Button } from '../../common/components/button';
import { TextField } from '../../common/components/text-field';
import { registerSchema } from './auth.schema';
import { loadMe } from './session';
import { useSession } from './session.store';

interface RegisterValues {
  email: string;
  password: string;
  displayName?: string;
}

/** Registration. An empty display name is omitted. */
export function RegisterForm() {
  const router = useRouter();
  const setAccount = useSession((state) => state.setAccount);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<RegisterValues>({ resolver: yupResolver(registerSchema) });
  return (
    <form className="mx-auto flex w-full max-w-sm flex-col gap-4 p-8" onSubmit={form.handleSubmit((values) => void submit(values, setAccount, setError, router))}>
      <h1 className="text-2xl font-semibold">Create an account</h1>
      <TextField label="Email" type="email" autoComplete="email" {...form.register('email')} />
      <TextField label="Display name" autoComplete="nickname" {...form.register('displayName')} />
      <TextField label="Password" type="password" autoComplete="new-password" {...form.register('password')} />
      {form.formState.errors.password ? <p>{form.formState.errors.password.message}</p> : null}
      {error !== null ? <p>{error}</p> : null}
      <Button type="submit">Create account</Button>
      <Link className="text-sm text-hira-accent" href="/login">Sign in</Link>
    </form>
  );
}

async function submit(
  values: RegisterValues,
  setAccount: ReturnType<typeof useSession.getState>['setAccount'],
  setError: (value: string | null) => void,
  router: ReturnType<typeof useRouter>,
): Promise<void> {
  const response = await coreFetch('/api/v1/auth/register', jsonBody(bodyOf(values)), null);
  if (!response.ok) {
    setError(await errorMessage(response));
    return;
  }
  const body = (await response.json()) as { accessToken?: string; expiresIn?: number };
  if (body.accessToken === undefined || body.expiresIn === undefined) return;
  const user = await loadMe(body.accessToken);
  if (user === null) return;
  setAccount({ accessToken: body.accessToken, expiresAt: Date.now() + body.expiresIn * 1000 }, user);
  router.push('/chat');
}

function bodyOf(values: RegisterValues): Record<string, string> {
  const body: Record<string, string> = { email: values.email, password: values.password };
  if (values.displayName !== undefined && values.displayName.trim().length > 0) body.displayName = values.displayName.trim();
  return body;
}

function jsonBody(body: Record<string, string>): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

async function errorMessage(response: Response): Promise<string> {
  const body = (await response.json()) as { message?: string };
  return body.message ?? 'Registration failed';
}
