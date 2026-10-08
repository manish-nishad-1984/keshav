import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Camera, ExternalLink, Loader2, Plus, Trash2, X } from 'lucide-react';
import { apiClient, ApiRequestError, resolvePhotoUrl } from '../../lib/api-client';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';
import type { KarigarDocumentType } from './karigar-constants';

export interface DocumentDraft {
  key: number;
  type: KarigarDocumentType;
  label: string;
  fileUrl: string | null;
}

let keySeq = 0;
export const newDocumentDraft = (type: KarigarDocumentType, fileUrl: string | null = null, label = ''): DocumentDraft => ({
  key: ++keySeq,
  type,
  label,
  fileUrl,
});

const FIXED: { type: KarigarDocumentType; title: string }[] = [
  { type: 'AADHAAR_FRONT', title: 'Aadhaar — Front' },
  { type: 'AADHAAR_BACK', title: 'Aadhaar — Back' },
  { type: 'PAN', title: 'PAN Card' },
];

// One proof photo: tap to take or upload, view full size, remove.
const DocumentTile = ({ title, value, onChange }: { title: string; value: string | null; onChange: (url: string | null) => void }) => {
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
  const src = resolvePhotoUrl(value);

  return (
    <div className="min-w-0 space-y-1">
      {title ? <p className="text-xs font-medium">{title}</p> : null}
      <div
        className={cn(
          'relative flex h-28 items-center justify-center overflow-hidden rounded-md border bg-muted text-muted-foreground',
          src ? 'border-border' : 'border-dashed border-border',
        )}
      >
        {upload.isPending ? (
          <Loader2 className="size-6 animate-spin" />
        ) : src ? (
          <>
            <img src={src} alt={title || 'ID proof'} className="size-full object-contain" />
            <div className="absolute right-1 top-1 flex gap-1">
              <a
                href={src}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${title}`}
                className="flex size-7 items-center justify-center rounded-md bg-card/90 text-foreground shadow-sm hover:bg-card"
              >
                <ExternalLink className="size-3.5" />
              </a>
              <button
                type="button"
                aria-label={`Remove ${title}`}
                onClick={() => onChange(null)}
                className="flex size-7 items-center justify-center rounded-md bg-card/90 text-foreground shadow-sm hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex size-full flex-col items-center justify-center gap-1 text-xs font-medium text-primary hover:bg-accent"
          >
            <Camera className="size-6" />
            Take / upload
          </button>
        )}
      </div>
      {error ? <p className="text-2xs text-destructive">{error}</p> : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label={title}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload.mutate(file);
          e.target.value = '';
        }}
      />
    </div>
  );
};

interface KarigarDocumentsSectionProps {
  documents: DocumentDraft[];
  onChange: (documents: DocumentDraft[]) => void;
}

// ID proofs: fixed slots for Aadhaar front/back and PAN, then any number of named other proofs.
export const KarigarDocumentsSection = ({ documents, onChange }: KarigarDocumentsSectionProps) => {
  const fixedUrl = (type: KarigarDocumentType) => documents.find((d) => d.type === type)?.fileUrl ?? null;
  const setFixed = (type: KarigarDocumentType, url: string | null) => {
    const rest = documents.filter((d) => d.type !== type);
    onChange(url ? [...rest, newDocumentDraft(type, url)] : rest);
  };
  const others = documents.filter((d) => d.type === 'OTHER');
  const updateOther = (key: number, patch: Partial<DocumentDraft>) =>
    onChange(documents.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  return (
    <section aria-labelledby="karigar-docs-heading" className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="karigar-docs-heading" className="text-sm font-semibold">
          ID Proof
          <span className="ml-2 text-xs font-normal text-muted-foreground">Photos of Aadhaar, PAN or any other ID</span>
        </h3>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...documents, newDocumentDraft('OTHER')])}>
          <Plus />
          Add Other Proof
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {FIXED.map((slot) => (
          <DocumentTile key={slot.type} title={slot.title} value={fixedUrl(slot.type)} onChange={(url) => setFixed(slot.type, url)} />
        ))}
        {others.map((doc, index) => (
          <div key={doc.key} className="min-w-0 space-y-1">
            <div className="flex items-center gap-1">
              <Input
                aria-label={`Name of other proof ${index + 1}`}
                placeholder="Proof name (e.g. Voter ID)"
                className="h-7 min-w-0 flex-1 px-2 text-xs max-sm:h-8"
                maxLength={60}
                value={doc.label}
                onChange={(e) => updateOther(doc.key, { label: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 hover:text-destructive [&_svg]:size-3.5"
                aria-label={`Remove other proof ${index + 1}`}
                onClick={() => onChange(documents.filter((d) => d.key !== doc.key))}
              >
                <Trash2 />
              </Button>
            </div>
            <DocumentTile title="" value={doc.fileUrl} onChange={(url) => updateOther(doc.key, { fileUrl: url })} />
          </div>
        ))}
      </div>
    </section>
  );
};
