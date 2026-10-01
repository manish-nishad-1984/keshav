import { useState } from 'react';
import { PageLayout, PageTabs } from '../components/layout/PageLayout';
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
        <PageTabs
          label="Payments"
          value={tab}
          onChange={setTab}
          items={[
            { key: 'ledger', label: 'Karigar Ledger' },
            { key: 'entry', label: 'Payment Entry' },
          ]}
        />
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
