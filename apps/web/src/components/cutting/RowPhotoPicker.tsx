import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ImagePlus, Loader2, X } from "lucide-react";
import {
  apiClient,
  ApiRequestError,
  resolvePhotoUrl,
} from "../../lib/api-client";
import { cn } from "../../lib/utils";
import { PhotoSourceMenu } from "../common/PhotoSourceMenu";

interface RowPhotoPickerProps {
  value: string | null;
  onChange: (url: string | null) => void;
  label: string;
}

// Compact cloth-photo control for a cutting grid row: a 40px square that opens the file picker
// and shows the uploaded thumbnail, with a small remove button. Same /uploads endpoint and file
// types as PhotoUpload.
export const RowPhotoPicker = ({
  value,
  onChange,
  label,
}: RowPhotoPickerProps) => {
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (file: File) =>
      apiClient.upload<{ url: string }>("/uploads", file),
    onSuccess: (result) => {
      setError(null);
      onChange(result.url);
    },
    onError: (err) =>
      setError(err instanceof ApiRequestError ? err.message : "Upload failed"),
  });
  const photoUrl = resolvePhotoUrl(value);

  return (
    <div className="relative size-10 shrink-0">
      <PhotoSourceMenu
        onFile={(file) => mutation.mutate(file)}
        disabled={mutation.isPending}
        label={label}
      >
        <button
          type="button"
          disabled={mutation.isPending}
          aria-label={value ? `Change ${label}` : `Upload ${label}`}
          title={
            error ??
            (value
              ? "Change photo (camera or gallery)"
              : "Add cloth photo (camera or gallery)")
          }
          className={cn(
            "flex size-10 items-center justify-center overflow-hidden rounded-md border bg-muted text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            error
              ? "border-destructive text-destructive"
              : "border-dashed border-input",
            value && "border-solid",
          )}
        >
          {mutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : photoUrl ? (
            <img src={photoUrl} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlus className="size-4" strokeWidth={1.75} />
          )}
        </button>
      </PhotoSourceMenu>
      {value && !mutation.isPending ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={`Remove ${label}`}
          className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-foreground/70 text-background hover:bg-destructive"
        >
          <X className="size-3" strokeWidth={2.5} />
        </button>
      ) : null}
    </div>
  );
};
