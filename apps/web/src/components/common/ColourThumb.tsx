import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { resolvePhotoUrl } from '../../lib/api-client';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

interface ColourThumbProps {
  photoUrl: string | null | undefined;
  name: string;
  size?: number;
  /** Tap to see the cloth photo big. Off for printouts. */
  zoom?: boolean;
}

// The cloth photo of a colour (entered when the lot was cut), shown beside that colour wherever
// quantities are listed per colour and size.
export const ColourThumb = ({ photoUrl, name, size = 40, zoom = true }: ColourThumbProps) => {
  const [open, setOpen] = useState(false);
  const url = resolvePhotoUrl(photoUrl);
  const box = { width: size, height: size };

  if (!url) {
    return (
      <span style={box} className="flex shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
        <ImageOff className="size-4" />
      </span>
    );
  }
  const image = <img src={url} alt={`${name} cloth`} style={box} className="rounded-md border border-border object-cover" />;
  if (!zoom) return <span className="shrink-0">{image}</span>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`${name} — tap to enlarge`}
        aria-label={`Enlarge ${name} cloth photo`}
        className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {image}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{name}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <img src={url} alt={`${name} cloth`} className="max-h-[70vh] w-full rounded-md object-contain" />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
};
