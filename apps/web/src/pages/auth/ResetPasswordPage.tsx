import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { apiClient, ApiRequestError } from '../../lib/api-client';
import { FormField } from '../../components/ui/form-field';
import { FormAlert } from '../../components/ui/form-alert';
import { PasswordInput } from '../../components/ui/password-input';
import { Button } from '../../components/ui/button';

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.post('/auth/reset-password', { token, password });
      navigate('/login', { replace: true });
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Reset password</h1>
        <p className="text-sm text-muted-foreground">Choose a new password for your account.</p>
      </div>

      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
      {!token ? <FormAlert tone="warning">This reset link is missing its token.</FormAlert> : null}

      <form className="space-y-4" noValidate onSubmit={handleSubmit}>
        <FormField label="New password" required htmlFor="password" hint="At least 8 characters.">
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>
        <FormField label="Confirm password" required htmlFor="confirmPassword">
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </FormField>
        <Button type="submit" className="w-full" loading={isSubmitting} disabled={!token}>
          Reset password{!isSubmitting && <ArrowRight />}
        </Button>
      </form>

      <p className="text-2xs text-muted-foreground">
        <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
};
