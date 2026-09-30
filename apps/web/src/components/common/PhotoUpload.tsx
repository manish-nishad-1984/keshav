import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ImageIcon, ImageOff, Loader2, User } from 'lucide-react';
import { apiClient, ApiRequestError, resolvePhotoUrl } from '../../lib/api-client';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface PhotoUploadProps {
  value: string | null;
  onChange: (url: string) => void;
  /** 'sm' renders a compact 56px square thumbnail for dense entry forms. */
  size?: 'default' | 'sm';
  id?: string;
  className?: string;
}

export const PhotoUpload = ({ value, onChange, size = 'default', id, className }: PhotoUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const compact = size === 'sm';

  const mutation = useMutation({
    mutationFn: (file: File) => apiClient.upload<{ url: string }>('/uploads', file),
    onSuccess: (result) => {
      setError(null);
      onChange(result.url);
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Upload failed'),
  });

  const photoUrl = resolvePhotoUrl(value);
  const iconClass = compact ? 'size-5' : 'size-6';

  return (
    <div className={cn('flex items-center', compact ? 'gap-2.5' : 'gap-3', className)}>
      <div
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden border border-border bg-muted text-muted-foreground',
          compact ? 'size-14 rounded-md' : 'size-20 rounded-full',
        )}
      >
        {mutation.isPending ? (
          <Loader2 className={cn(iconClass, 'animate-spin')} />
        ) : photoUrl ? (
          <img src={photoUrl} alt={compact ? 'Uploaded photo preview' : ''} className="size-full object-cover" />
        ) : error ? (
          <ImageOff className={iconClass} />
        ) : compact ? (
          <ImageIcon className={iconClass} />
        ) : (
          <User className="size-8" />
        )}
      </div>
      <div className="min-w-0 space-y-1">
        <Button
          id={id}
          type="button"
          variant="outline"
          size="sm"
          className={compact ? 'h-11 sm:h-8' : undefined}
          onClick={() => inputRef.current?.click()}
          disabled={mutation.isPending}
        >
          Change Photo
        </Button>
        {error ? <p className="text-2xs text-destructive">{error}</p> : null}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) mutation.mutate(file);
          }}
        />
      </div>
    </div>
  );
};
