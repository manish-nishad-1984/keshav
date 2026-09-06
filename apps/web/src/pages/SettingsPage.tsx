import { useState } from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { Card } from '../components/ui/card';
import { cn } from '../lib/utils';
import { CompanyInfoTab } from '../components/settings/CompanyInfoTab';
import { WorkTypeTab } from '../components/settings/WorkTypeTab';
import { UserManagementTab } from '../components/settings/UserManagementTab';
import { BackupRestoreTab } from '../components/settings/BackupRestoreTab';
import { GeneralSettingsTab } from '../components/settings/GeneralSettingsTab';

const TABS = [
  { key: 'company', label: 'Company Info' },
  { key: 'work-type', label: 'Work Type' },
  { key: 'users', label: 'User Management' },
  { key: 'backup', label: 'Backup & Restore' },
  { key: 'general', label: 'General Settings' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export const SettingsPage = () => {
  const [tab, setTab] = useState<TabKey>('company');

  return (
    <PageLayout title="Settings" description="Company info, work types, and general configuration.">
      <div className="grid gap-5 md:grid-cols-[14rem_minmax(0,1fr)]">
        <Card className="h-fit p-2">
          <nav className="flex flex-col gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  'rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
                  tab === t.key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </Card>

        <div className="min-w-0">
          {tab === 'company' ? <CompanyInfoTab /> : null}
          {tab === 'work-type' ? <WorkTypeTab /> : null}
          {tab === 'users' ? <UserManagementTab /> : null}
          {tab === 'backup' ? <BackupRestoreTab /> : null}
          {tab === 'general' ? <GeneralSettingsTab /> : null}
        </div>
      </div>
    </PageLayout>
  );
};
