import { useState } from 'react';
import { KarigarListView } from '../components/karigars/KarigarListView';
import { KarigarFormView } from '../components/karigars/KarigarFormView';
import type { Karigar } from '../components/karigars/karigar-constants';

type ViewState = { mode: 'list' } | { mode: 'form'; karigar: Karigar | null };

export const KarigarsPage = () => {
  const [view, setView] = useState<ViewState>({ mode: 'list' });

  if (view.mode === 'form') {
    return (
      <KarigarFormView
        karigar={view.karigar}
        onDone={() => setView({ mode: 'list' })}
        onCancel={() => setView({ mode: 'list' })}
      />
    );
  }

  return (
    <KarigarListView
      onAdd={() => setView({ mode: 'form', karigar: null })}
      onEdit={(karigar) => setView({ mode: 'form', karigar })}
    />
  );
};
