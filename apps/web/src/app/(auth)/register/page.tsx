'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/lib/stores/auth.store';

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
});
type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser, isLoading } = useAuthStore();
  const [checkEmail, setCheckEmail] = useState(false);

  const { register, handleSubmit, setError, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      await registerUser(data.email, data.password, data.name);
      // Supabase sends a confirmation email — show check-email message
      setCheckEmail(true);
    } catch (err: any) {
      setError('email', { message: err?.message ?? 'Registration failed' });
    }
  };

  if (checkEmail) {
    return (
      <div className="text-center">
        <div className="text-4xl mb-4">📬</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Check your email</h1>
        <p className="text-gray-500 text-sm">
          We sent a confirmation link to your email address. Click it to activate your account.
        </p>
        <p className="mt-4 text-sm text-gray-400">
          Already confirmed?{' '}
          <button onClick={() => router.push('/login')} className="text-brand-600 hover:underline">
            Sign in
          </button>
        </p>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Create account</h1>
      <p className="text-sm text-gray-500 mb-6">Start automating your social media with AI</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input id="name" label="Full name" placeholder="Jane Smith"
          error={errors.name?.message} {...register('name')} />
        <Input id="email" label="Email" type="email" placeholder="you@example.com"
          error={errors.email?.message} {...register('email')} />
        <Input id="password" label="Password" type="password" placeholder="Min. 8 characters"
          error={errors.password?.message} {...register('password')} />
        <Input id="confirm" label="Confirm password" type="password" placeholder="••••••••"
          error={errors.confirm?.message} {...register('confirm')} />

        <Button type="submit" className="w-full" loading={isLoading}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link href="/login" className="text-brand-600 hover:text-brand-700 font-medium">Sign in</Link>
      </p>
    </>
  );
}
