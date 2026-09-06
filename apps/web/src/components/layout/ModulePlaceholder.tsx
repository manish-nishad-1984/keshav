import type { ModuleDefinition } from '@ckfast/shared';
import { resolveIcon } from '../../lib/icons';
import { PageLayout } from './PageLayout';

export const ModulePlaceholder = ({ module }: { module: ModuleDefinition }) => {
  const Icon = resolveIcon(module.icon);
  return (
    <PageLayout title={module.label} description={module.description}>
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium">{module.label} is not built yet</p>
          <p className="text-xs text-muted-foreground">
            This module is registered but has no page yet — add it to <code>MODULE_PAGES</code>.
          </p>
        </div>
      </div>
    </PageLayout>
  );
};
