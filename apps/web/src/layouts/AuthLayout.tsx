import { Suspense } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Zap, ShieldCheck, History, Users } from 'lucide-react';
import { LoadingState } from '../components/ui/loading-state';

const TAGLINE = 'Business Operations Platform';
const EYEBROW = 'Operations Platform';
const HEADLINE = 'Run your operations from one place.';
const SUBCOPY =
  'KESHAV Trading & Co. brings your teams, roles, and records into a single, secure workspace — built to grow with every process you add.';

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Role-based access',
    body: 'Every screen and action is guarded by permissions your admins control.',
  },
  {
    icon: History,
    title: 'Full audit trail',
    body: 'Every create, update, and status change is recorded automatically.',
  },
  {
    icon: Users,
    title: 'Built for teams',
    body: 'Branches, reporting lines, and multi-tenant organizations, out of the box.',
  },
];

export const AuthLayout = () => (
  <div className="grid min-h-screen lg:grid-cols-2">
    <div className="flex flex-col justify-center px-6 py-10 sm:px-12 lg:order-2">
      <div className="mx-auto w-full max-w-sm">
        <Link to="/login" className="mb-8 flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Zap className="size-5" strokeWidth={2.5} />
          </span>
          <span>
            <span className="block text-sm font-semibold leading-tight">KESHAV Trading & Co.</span>
            <span className="block text-2xs text-muted-foreground">{TAGLINE}</span>
          </span>
        </Link>
        <Suspense fallback={<LoadingState variant="page" label="Loading…" />}>
          <Outlet />
        </Suspense>
      </div>
    </div>

    <aside className="relative hidden overflow-hidden bg-primary lg:order-1 lg:flex lg:flex-col lg:justify-between">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-white/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-20 size-80 rounded-full bg-white/20 blur-3xl"
      />
      <div className="relative p-12">
        <p className="text-2xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/70">{EYEBROW}</p>
        <h2 className="mt-3 max-w-md text-3xl font-semibold leading-tight text-primary-foreground">{HEADLINE}</h2>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-primary-foreground/80">{SUBCOPY}</p>
      </div>
      <ul className="relative space-y-4 p-12">
        {FEATURES.map((f) => (
          <li className="flex items-start gap-3" key={f.title}>
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-primary-foreground/15 text-primary-foreground">
              <f.icon className="size-4" />
            </span>
            <span>
              <span className="block text-sm font-medium text-primary-foreground">{f.title}</span>
              <span className="block text-xs text-primary-foreground/75">{f.body}</span>
            </span>
          </li>
        ))}
      </ul>
    </aside>
  </div>
);
