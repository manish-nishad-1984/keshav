import { useState } from 'react';
import { DeliveryListView } from '../components/deliveries/DeliveryListView';
import { DeliveryFormView } from '../components/deliveries/DeliveryFormView';
import { DeliveryChallanView } from '../components/deliveries/DeliveryChallanView';
import type { Delivery } from '../components/deliveries/delivery-constants';

type ViewState = { mode: 'list' } | { mode: 'form'; delivery: Delivery | null } | { mode: 'challan'; deliveryId: string; openWhatsapp?: boolean };

export const DeliveriesPage = () => {
  const [view, setView] = useState<ViewState>({ mode: 'list' });
  const toList = () => setView({ mode: 'list' });

  if (view.mode === 'form') {
    return (
      <DeliveryFormView
        delivery={view.delivery}
        onDone={(saved) => setView({ mode: 'challan', deliveryId: saved.id })}
        onCancel={toList}
      />
    );
  }

  if (view.mode === 'challan') return <DeliveryChallanView deliveryId={view.deliveryId} openWhatsapp={view.openWhatsapp} onBack={toList} />;

  return (
    <DeliveryListView
      onAdd={() => setView({ mode: 'form', delivery: null })}
      onEdit={(delivery) => setView({ mode: 'form', delivery })}
      onChallan={(delivery) => setView({ mode: 'challan', deliveryId: delivery.id })}
      onWhatsapp={(delivery) => setView({ mode: 'challan', deliveryId: delivery.id, openWhatsapp: true })}
    />
  );
};
