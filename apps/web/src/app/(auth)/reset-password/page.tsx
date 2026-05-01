'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const schema = z.object({
  password: z.string().min(8, 'At least 8 characters'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
});
type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async ({ password }: FormData) => {
    setLoading(true);
    setError('');
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw new Error(err.message);
      router.push('/dashboard');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Set new password</h1>
      <p className="text-sm text-gray-500 mb-6">Choose a strong password for your account.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input id="password" label="New password" type="password" placeholder="Min. 8 characters"
          error={errors.password?.message} {...register('password')} />
        <Input id="confirm" label="Confirm password" type="password" placeholder="••••••••"
          error={errors.confirm?.message} {...register('confirm')} />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" className="w-full" loading={loading}>
          Update password
        </Button>
      </form>
    </>
  );
}
