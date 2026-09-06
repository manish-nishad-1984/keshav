import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { PageLayout } from '../components/layout/PageLayout';
import { Card } from '../components/ui/card';
import { resolveIcon } from '../lib/icons';
import { REPORT_TYPES, type ReportKey } from '../components/reports/report-constants';
import { ReportPreviewView } from '../components/reports/ReportPreviewView';

export const ReportsPage = () => {
  const [reportKey, setReportKey] = useState<ReportKey | null>(null);

  if (reportKey) {
    return (
      <PageLayout title="Reports" description="Production, karigar, item, and payment reports.">
        <ReportPreviewView reportKey={reportKey} onBack={() => setReportKey(null)} />
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Reports" description="Production, karigar, item, and payment reports.">
      <Card className="divide-y divide-border">
        {REPORT_TYPES.map((report) => {
          const Icon = resolveIcon(report.icon);
          return (
            <button
              key={report.key}
              type="button"
              onClick={() => setReportKey(report.key)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Icon className="size-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{report.title}</p>
                <p className="text-2xs text-muted-foreground">{report.description}</p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
          );
        })}
      </Card>
    </PageLayout>
  );
};
