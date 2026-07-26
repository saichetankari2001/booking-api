import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAdminAuth } from '../context/AdminAuthContext';
import { loginFormSchema, LoginFormInput } from '../lib/schemas/auth.schema';
import { Button } from '../components/Button';
import { ApiError } from '../api/apiClient';

export default function AdminLogin() {
  const { login } = useAdminAuth();
  const navigate = useNavigate();
  const [loginError, setLoginError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormInput>({ resolver: zodResolver(loginFormSchema) });

  async function onSubmit(values: LoginFormInput) {
    setLoginError(null);
    try {
      await login(values.email, values.password);
      navigate('/admin/bookings');
    } catch (err) {
      setLoginError(
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.',
      );
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-sm w-full">
        <h1 className="font-display text-2xl font-semibold mb-6">Admin login</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="w-full rounded border border-border px-3 py-2"
              {...register('email')}
            />
            {errors.email && (
              <p role="alert" className="text-accent text-sm mt-1">
                {errors.email.message}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="w-full rounded border border-border px-3 py-2"
              {...register('password')}
            />
            {errors.password && (
              <p role="alert" className="text-accent text-sm mt-1">
                {errors.password.message}
              </p>
            )}
          </div>
          {loginError && (
            <p role="alert" className="text-accent text-sm">
              {loginError}
            </p>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Logging in…' : 'Log in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
