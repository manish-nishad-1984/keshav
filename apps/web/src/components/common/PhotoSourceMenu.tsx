import { useRef, type ReactNode } from 'react';
import { Camera, Images } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';

interface PhotoSourceMenuProps {
  /** The button that opens the menu (rendered as-is, so it keeps its own styling). */
  children: ReactNode;
  onFile: (file: File) => void;
  disabled?: boolean;
  label?: string;
}

// "Take photo" opens the phone camera directly; "Choose from gallery" opens the file picker.
// (On a computer the camera option falls back to the normal file picker.)
export const PhotoSourceMenu = ({ children, onFile, disabled, label = 'Photo' }: PhotoSourceMenuProps) => {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onFile(file);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          {children}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => cameraRef.current?.click()}>
            <Camera className="size-4" />
            Take photo (camera)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => galleryRef.current?.click()}>
            <Images className="size-4" />
            Choose from gallery
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" aria-label={`${label} — camera`} onChange={handle} />
      <input ref={galleryRef} type="file" accept="image/png,image/jpeg,image/webp,image/*" className="hidden" aria-label={`${label} — gallery`} onChange={handle} />
    </>
  );
};
