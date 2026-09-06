import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface PageLayoutProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  tabs?: ReactNode;
  children: ReactNode;
  className?: string;
}

export const PageLayout = ({ title, description, actions, tabs, children, className }: PageLayoutProps) => (
  <div className={cn('space-y-5', className)}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
    {tabs}
    {children}
  </div>
);

interface DetailPageLayoutProps {
  main: ReactNode;
  aside: ReactNode;
  className?: string;
}

export const DetailPageLayout = ({ main, aside, className }: DetailPageLayoutProps) => (
  <div className={cn('grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]', className)}>
    <div className="min-w-0 space-y-5">{main}</div>
    <div className="space-y-5 xl:w-80">{aside}</div>
  </div>
);
