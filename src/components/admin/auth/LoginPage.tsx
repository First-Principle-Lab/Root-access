'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/src/lib/api';
import { useAuth } from '@/src/contexts/authContext';
import { AdminButton } from '../../ui/admin-button';
import { AdminField, AdminInput } from '../../ui/admin-field';
import { Notice } from '../../ui/notice';
import { AdminAuthLoading, AdminAuthShell } from './AdminAuthShell';

export function AdminLoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, checkAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/admin');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await adminApi.login({ email, secretKey });
      await checkAuth();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return <AdminAuthLoading />;
  }

  if (isAuthenticated) {
    return null;
  }

  return (
    <AdminAuthShell title="Admin Login" description="Sign in to manage your site.">
        <form onSubmit={handleSubmit} className="space-y-[var(--admin-space-5)]">
          {error && <Notice id="login-error" tone="error" assertive>{error}</Notice>}

          <AdminField label="Email" id="email" required>
            <AdminInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              aria-describedby={error ? 'login-error' : undefined}
            />
          </AdminField>

          <AdminField label="Secret Key" id="secretKey" required>
            <AdminInput
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              required
              autoComplete="current-password"
              aria-describedby={error ? 'login-error' : undefined}
            />
          </AdminField>

          <AdminButton
            type="submit"
            variant="primary"
            loading={loading}
            className="w-full"
          >
            Login
          </AdminButton>

          <p className="text-center text-[length:var(--admin-text-meta)] text-[color:var(--admin-muted)]">
            Don&apos;t have an account?{' '}
            <Link href="/admin/signup" className="font-medium text-[color:var(--admin-heading)] underline-offset-4 hover:underline">
              Sign up
            </Link>
          </p>
        </form>
    </AdminAuthShell>
  );
}
