import { useState } from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { cn } from '../lib/utils';
import { KarigarLedgerView } from '../components/payments/KarigarLedgerView';
import { PaymentEntryView } from '../components/payments/PaymentEntryView';

type Tab = 'ledger' | 'entry';

export const PaymentsPage = () => {
  const [tab, setTab] = useState<Tab>('ledger');

  return (
    <PageLayout
      title="Payment / Ledger"
      description="Per-karigar payment ledger and payment entries."
      tabs={
        <div className="inline-flex rounded-md border border-border bg-muted p-1">
          {(['ledger', 'entry'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                'rounded-sm px-3 py-1.5 text-xs font-medium transition-colors',
                tab === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {key === 'ledger' ? 'Karigar Ledger' : 'Payment Entry'}
            </button>
          ))}
        </div>
      }
    >
      {tab === 'ledger' ? (
        <KarigarLedgerView onAddPayment={() => setTab('entry')} />
      ) : (
        <PaymentEntryView onDone={() => setTab('ledger')} onCancel={() => setTab('ledger')} />
      )}
    </PageLayout>
  );
};
