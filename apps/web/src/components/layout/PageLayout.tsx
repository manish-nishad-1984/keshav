import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { shortLabel, useNavigation } from '../../lib/navigation';
import { cn } from '../../lib/utils';

interface PageLayoutProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Custom tabs. When omitted, sibling pages of the current nav section are shown as tabs. */
  tabs?: ReactNode;
  children: ReactNode;
  className?: string;
}

// Contextual navigation: the other pages in the active sidebar section (e.g. Daily Entry /
// History / Photo Gallery under Production), permission-filtered. Renders nothing for
// single-page sections.
const SectionTabs = () => {
  const { activeSection } = useNavigation();
  if (!activeSection || activeSection.modules.length < 2) return null;

  return (
    <nav aria-label={`${activeSection.label} pages`} className="-mt-1 overflow-x-auto border-b border-border">
      <ul className="flex min-w-max gap-1">
        {activeSection.modules.map((module) => (
          <li key={module.key}>
            <NavLink
              to={module.path}
              className={({ isActive }) =>
                cn(
                  'relative -mb-px flex h-11 items-center border-b-2 px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:h-9',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-foreground-soft hover:border-input hover:text-foreground',
                )
              }
            >
              {shortLabel(module)}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};

// "Production / Daily Entry" — only for sections with several pages; a single-page section's
// breadcrumb would just repeat the title.
const Breadcrumb = () => {
  const { activeSection, activeModule } = useNavigation();
  if (!activeSection || !activeModule || activeSection.modules.length < 2) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-0.5">
      <ol className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <li>
          <Link to={activeSection.modules[0].path} className="rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {activeSection.label}
          </Link>
        </li>
        <li aria-hidden>/</li>
        <li aria-current="page" className="font-medium text-foreground">
          {shortLabel(activeModule)}
        </li>
      </ol>
    </nav>
  );
};

export const PageLayout = ({ title, description, actions, tabs, children, className }: PageLayoutProps) => (
  <div className={cn('space-y-3', className)}>
    <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
      <div className="min-w-0">
        <Breadcrumb />
        <h1 className="text-lg font-semibold leading-7 tracking-tight text-foreground sm:text-xl">{title}</h1>
        {description ? <p className="truncate text-xs text-muted-foreground sm:text-[13px]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
    {tabs ?? <SectionTabs />}
    {children}
  </div>
);

interface DetailPageLayoutProps {
  main: ReactNode;
  aside: ReactNode;
  className?: string;
}

export const DetailPageLayout = ({ main, aside, className }: DetailPageLayoutProps) => (
  <div className={cn('grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]', className)}>
    <div className="min-w-0 space-y-4">{main}</div>
    <div className="space-y-4 xl:w-80">{aside}</div>
  </div>
);

interface PageTabsProps<T extends string> {
  items: readonly { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  label: string;
}

// In-page tabs (state-driven, not routes) styled like the section tabs above.
export const PageTabs = <T extends string>({ items, value, onChange, label }: PageTabsProps<T>) => (
  <div role="tablist" aria-label={label} className="-mt-1 flex gap-1 overflow-x-auto border-b border-border">
    {items.map((item) => (
      <button
        key={item.key}
        type="button"
        role="tab"
        aria-selected={value === item.key}
        onClick={() => onChange(item.key)}
        className={cn(
          '-mb-px flex h-11 shrink-0 items-center border-b-2 px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:h-9',
          value === item.key
            ? 'border-primary text-primary'
            : 'border-transparent text-foreground-soft hover:border-input hover:text-foreground',
        )}
      >
        {item.label}
      </button>
    ))}
  </div>
);
