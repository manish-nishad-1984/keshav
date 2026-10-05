import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Camera, ImageOff, Loader2, RefreshCw } from 'lucide-react';
import { apiClient, ApiRequestError, resolvePhotoUrl } from '../../lib/api-client';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface ProductionPhotoCompareProps {
  lotPhotoUrl: string | null;
  value: string | null;
  onChange: (url: string) => void;
}

const Frame = ({ title, children, tone }: { title: string; children: React.ReactNode; tone?: 'primary' }) => (
  <figure className="min-w-0 space-y-1">
    <figcaption className={cn('text-2xs font-semibold uppercase tracking-wider', tone === 'primary' ? 'text-primary' : 'text-muted-foreground')}>
      {title}
    </figcaption>
    <div
      className={cn(
        'relative flex h-36 items-center justify-center overflow-hidden rounded-md border bg-muted text-muted-foreground',
        tone === 'primary' ? 'border-primary/40' : 'border-border',
      )}
    >
      {children}
    </div>
  </figure>
);

// The lot's design next to the photo of what came back, so they can be compared at a glance. On
// a tablet the picker offers the camera as well as the photo library.
export const ProductionPhotoCompare = ({ lotPhotoUrl, value, onChange }: ProductionPhotoCompareProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const upload = useMutation({
    mutationFn: (file: File) => apiClient.upload<{ url: string }>('/uploads', file),
    onSuccess: (result) => {
      setError(null);
      onChange(result.url);
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Upload failed'),
  });

  const lotPhoto = resolvePhotoUrl(lotPhotoUrl);
  const production = resolvePhotoUrl(value);

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 gap-3">
        <Frame title="Lot design">
          {lotPhoto ? (
            <img src={lotPhoto} alt="Design photo of the lot" className="size-full object-contain" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-xs">
              <ImageOff className="size-6" />
              No lot photo
            </span>
          )}
        </Frame>
        <Frame title="Production" tone="primary">
          {upload.isPending ? (
            <Loader2 className="size-7 animate-spin" />
          ) : production ? (
            <img src={production} alt="Photo of the finished production" className="size-full object-contain" />
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex size-full flex-col items-center justify-center gap-1.5 text-sm font-medium text-primary hover:bg-accent"
            >
              <Camera className="size-8" />
              Take / upload photo
            </button>
          )}
          {production && !upload.isPending ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="absolute bottom-2 right-2 bg-card/90"
              onClick={() => inputRef.current?.click()}
            >
              <RefreshCw />
              Retake
            </Button>
          ) : null}
        </Frame>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Production photo"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload.mutate(file);
          e.target.value = '';
        }}
      />
    </div>
  );
};
