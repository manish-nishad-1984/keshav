import { useState } from 'react';
import { DistributionListView } from '../components/cutting-distribution/DistributionListView';
import { DistributionFormView } from '../components/cutting-distribution/DistributionFormView';
import type { Distribution } from '../components/cutting-distribution/distribution-constants';

type ViewState = { mode: 'list' } | { mode: 'form'; distribution: Distribution | null };

export const CuttingDistributionPage = () => {
  const [view, setView] = useState<ViewState>({ mode: 'list' });

  if (view.mode === 'form') {
    return (
      <DistributionFormView
        distribution={view.distribution}
        onDone={() => setView({ mode: 'list' })}
        onCancel={() => setView({ mode: 'list' })}
      />
    );
  }

  return (
    <DistributionListView
      onAdd={() => setView({ mode: 'form', distribution: null })}
      onEdit={(distribution) => setView({ mode: 'form', distribution })}
    />
  );
};
