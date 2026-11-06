'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AdminButton } from '../../ui/admin-button';
import { AdminField, AdminInput } from '../../ui/admin-field';
import { Notice } from '../../ui/notice';
import { AdminAuthLoading, AdminAuthShell } from './AdminAuthShell';

export function AdminSignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    secretKey: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingEligibility, setCheckingEligibility] = useState(true);

  // Check if signup is allowed on component mount
  useEffect(() => {
    async function checkSignupEligibility() {
      try {
        const response = await fetch('/api/admin/check-signup');
        const data = await response.json();
        
        if (!data.allowSignup) {
          // Redirect to login if an admin already exists
          router.push('/admin/login');
          return;
        }
      } catch (error) {
        console.error('Failed to check signup eligibility:', error);
        setError('Unable to verify signup eligibility. Please try again.');
        // Still allow the form to show - API will validate on submit
      } finally {
        setCheckingEligibility(false);
      }
    }

    checkSignupEligibility();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Signup failed');
      }

      // Redirect to login after successful signup
      router.push('/admin/login');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while checking eligibility
  if (checkingEligibility) {
    return <AdminAuthLoading />;
  }

  return (
    <AdminAuthShell title="Admin Signup" description="Create the first administrator account.">
        <form onSubmit={handleSubmit} className="space-y-[var(--admin-space-5)]">
          {error && <Notice id="signup-error" tone="error" assertive>{error}</Notice>}

          <AdminField label="Name" id="name" required>
            <AdminInput
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              autoComplete="name"
              aria-describedby={error ? 'signup-error' : undefined}
            />
          </AdminField>

          <AdminField label="Email" id="email" required>
            <AdminInput
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              autoComplete="email"
              aria-describedby={error ? 'signup-error' : undefined}
            />
          </AdminField>

          <AdminField label="Secret Key" id="secretKey" hint="Keep this key private. You will use it to sign in." required>
            <AdminInput
              type="password"
              value={formData.secretKey}
              onChange={(e) => setFormData({ ...formData, secretKey: e.target.value })}
              required
              autoComplete="new-password"
              aria-describedby={error ? 'signup-error' : undefined}
            />
          </AdminField>

          <AdminButton
            type="submit"
            variant="primary"
            loading={loading}
            className="w-full"
          >
            Sign Up
          </AdminButton>

          <p className="text-center text-[length:var(--admin-text-meta)] text-[color:var(--admin-muted)]">
            Already have an account?{' '}
            <Link href="/admin/login" className="font-medium text-[color:var(--admin-heading)] underline-offset-4 hover:underline">
              Login
            </Link>
          </p>
        </form>
    </AdminAuthShell>
  );
}
