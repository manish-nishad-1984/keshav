import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { apiClient, ApiRequestError } from '../../lib/api-client';
import { FormField } from '../../components/ui/form-field';
import { FormAlert } from '../../components/ui/form-alert';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';

export const ForgotPasswordPage = () => {
  const [identifier, setIdentifier] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      await apiClient.post('/auth/forgot-password', { identifier });
      setSent(true);
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Forgot password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email or mobile number and we&apos;ll send you a reset link if an account exists.
        </p>
      </div>

      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}
      {sent ? (
        <FormAlert tone="success">If an account exists, password reset instructions have been sent.</FormAlert>
      ) : (
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <FormField label="Email or mobile" required htmlFor="identifier">
            <Input
              id="identifier"
              autoComplete="username"
              inputMode="email"
              placeholder="you@company.com or 9825000001"
              autoFocus
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </FormField>
          <Button type="submit" className="w-full" loading={isSubmitting}>
            Send reset link{!isSubmitting && <ArrowRight />}
          </Button>
        </form>
      )}

      <p className="text-2xs text-muted-foreground">
        <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
};
