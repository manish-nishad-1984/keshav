import { runWorkerOnce } from '../modules/whatsapp/whatsapp.service';

let running = false;

// Every 20 seconds: sends queued WhatsApp messages (retries included) and updates delivered / read.
// Cheap when idle: one small query for organizations that have WhatsApp set up.
export const startWhatsappWorker = () => {
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    runWorkerOnce()
      .catch((err) => console.error('WhatsApp worker failed:', err))
      .finally(() => {
        running = false;
      });
  }, 20000);
  timer.unref();
};
