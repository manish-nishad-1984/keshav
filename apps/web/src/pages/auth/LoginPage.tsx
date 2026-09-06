import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ApiRequestError } from '../../lib/api-client';
import { FormField } from '../../components/ui/form-field';
import { FormAlert } from '../../components/ui/form-alert';
import { Input } from '../../components/ui/input';
import { PasswordInput } from '../../components/ui/password-input';
import { Checkbox } from '../../components/ui/checkbox';
import { Label } from '../../components/ui/label';
import { Button } from '../../components/ui/button';

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      await login(identifier, password, rememberMe);
      const redirectTo = (location.state as { from?: string } | null)?.from ?? '/dashboard';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">Use your work email address or registered mobile number.</p>
      </div>

      {formError ? <FormAlert tone="error">{formError}</FormAlert> : null}

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
        <FormField label="Password" required htmlFor="password">
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox id="rememberMe" checked={rememberMe} onCheckedChange={(v) => setRememberMe(v === true)} />
            <Label htmlFor="rememberMe" className="cursor-pointer font-normal">
              Keep me signed in
            </Label>
          </div>
          <Link to="/forgot-password" className="text-xs font-medium text-primary underline-offset-4 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" loading={isSubmitting}>
          Sign in{!isSubmitting && <ArrowRight />}
        </Button>
      </form>

      <p className="text-2xs leading-relaxed text-muted-foreground">
        Access is granted by your administrator. If you cannot sign in, ask them to check your account status and
        assigned role. Repeated failed attempts lock the account temporarily.
      </p>
    </div>
  );
};
