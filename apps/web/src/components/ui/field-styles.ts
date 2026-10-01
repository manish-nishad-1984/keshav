// Shared look for text-like form controls (Input, Textarea, SelectTrigger — and DatePicker via
// Input), so they stay identical:
//  - default: subtly tinted fill, thin neutral border, darker border on hover
//  - focus: white fill, blue border and soft blue ring
//  - disabled: gray fill, muted text, not-allowed cursor
//  - read-only (Input/Textarea only, see readOnlyField): gray fill, normal text, no focus ring
//  - error: see invalidField
export const fieldBase =
  'rounded-md border border-input bg-muted text-sm text-foreground transition-[color,background-color,border-color,box-shadow] duration-150 placeholder:text-muted-foreground/80 hover:border-foreground/25 focus-visible:border-primary focus-visible:bg-card focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground disabled:hover:border-input max-sm:text-base';

// Not applied to SelectTrigger: a <button> always matches :read-only.
export const readOnlyField =
  'read-only:bg-secondary read-only:hover:border-input read-only:focus-visible:border-input read-only:focus-visible:ring-0';

export const invalidField =
  'border-destructive hover:border-destructive focus-visible:border-destructive focus-visible:ring-destructive/15';
