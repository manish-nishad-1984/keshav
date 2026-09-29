import { useState } from 'react';
import { CuttingListView } from '../components/cutting/CuttingListView';
import { CuttingFormView } from '../components/cutting/CuttingFormView';
import type { CuttingEntry } from '../components/cutting/cutting-constants';

type ViewState = { mode: 'list' } | { mode: 'form'; entry: CuttingEntry | null };

export const CuttingPage = () => {
  const [view, setView] = useState<ViewState>({ mode: 'list' });

  if (view.mode === 'form') {
    return (
      <CuttingFormView
        entry={view.entry}
        onDone={() => setView({ mode: 'list' })}
        onCancel={() => setView({ mode: 'list' })}
      />
    );
  }

  return (
    <CuttingListView
      onAdd={() => setView({ mode: 'form', entry: null })}
      onEdit={(entry) => setView({ mode: 'form', entry })}
    />
  );
};
