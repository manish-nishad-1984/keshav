import { useState } from 'react';
import { AccessoryIssueListView } from '../components/accessories/AccessoryIssueListView';
import { AccessoryIssueFormView } from '../components/accessories/AccessoryIssueFormView';
import type { AccessoryTransaction, AccessoryTransactionType } from '../components/accessories/accessory-constants';

type ViewState =
  | { mode: 'list' }
  | { mode: 'form'; transaction: AccessoryTransaction | null; type: AccessoryTransactionType };

export const AccessoryIssuesPage = () => {
  const [view, setView] = useState<ViewState>({ mode: 'list' });

  if (view.mode === 'form') {
    return (
      <AccessoryIssueFormView
        key={view.transaction?.id ?? view.type}
        transaction={view.transaction}
        initialType={view.type}
        onDone={() => setView({ mode: 'list' })}
        onCancel={() => setView({ mode: 'list' })}
      />
    );
  }

  return (
    <AccessoryIssueListView
      onAdd={(type) => setView({ mode: 'form', transaction: null, type })}
      onEdit={(transaction) => setView({ mode: 'form', transaction, type: transaction.type })}
    />
  );
};
