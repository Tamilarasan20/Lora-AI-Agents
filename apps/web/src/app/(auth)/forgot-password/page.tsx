'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const schema = z.object({ email: z.string().email('Invalid email') });
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async ({ email }: FormData) => {
    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center">
        <div className="text-4xl mb-4">📬</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h1>
        <p className="text-sm text-gray-500">
          If that email is registered, you&apos;ll receive a reset link shortly.
        </p>
        <Link href="/login" className="mt-6 block text-sm text-brand-600 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Reset password</h1>
      <p className="text-sm text-gray-500 mb-6">
        Enter your email and we&apos;ll send a reset link.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input id="email" label="Email" type="email" placeholder="you@example.com"
          error={errors.email?.message} {...register('email')} />

        <Button type="submit" className="w-full" loading={loading}>
          Send reset link
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Remember your password?{' '}
        <Link href="/login" className="text-brand-600 hover:text-brand-700 font-medium">
          Sign in
        </Link>
      </p>
    </>
  );
}
