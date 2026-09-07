import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ImageOff, Loader2, User } from 'lucide-react';
import { apiClient, ApiRequestError, resolvePhotoUrl } from '../../lib/api-client';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface PhotoUploadProps {
  value: string | null;
  onChange: (url: string) => void;
  className?: string;
}

export const PhotoUpload = ({ value, onChange, className }: PhotoUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (file: File) => apiClient.upload<{ url: string }>('/uploads', file),
    onSuccess: (result) => {
      setError(null);
      onChange(result.url);
    },
    onError: (err) => setError(err instanceof ApiRequestError ? err.message : 'Upload failed'),
  });

  const photoUrl = resolvePhotoUrl(value);

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-muted-foreground">
        {mutation.isPending ? (
          <Loader2 className="size-6 animate-spin" />
        ) : photoUrl ? (
          <img src={photoUrl} alt="" className="size-full object-cover" />
        ) : error ? (
          <ImageOff className="size-6" />
        ) : (
          <User className="size-8" />
        )}
      </div>
      <div className="space-y-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
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
