// Shared look for text-like form controls (Input, Textarea, SelectTrigger — and DatePicker via
// Input), so they stay identical:
//  - default: tinted fill, thin slate border, slightly deeper fill on hover
//  - focus: white fill, blue border and soft blue ring
//  - disabled: gray fill, muted text, not-allowed cursor
//  - read-only (Input/Textarea only, see readOnlyField): gray fill, normal text, no focus ring
//  - error: see invalidField
export const fieldBase =
  'rounded-md border border-input bg-muted text-sm text-input-foreground transition-[color,background-color,border-color,box-shadow] duration-150 placeholder:text-placeholder hover:bg-input-hover focus-visible:border-ring focus-visible:bg-card focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/10 disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground disabled:hover:border-input disabled:hover:bg-secondary max-sm:text-base';

// Not applied to SelectTrigger: a <button> always matches :read-only.
export const readOnlyField =
  'read-only:bg-secondary read-only:hover:border-input read-only:hover:bg-secondary read-only:focus-visible:border-input read-only:focus-visible:ring-0';

export const invalidField =
  'border-destructive hover:border-destructive focus-visible:border-destructive focus-visible:ring-destructive/15';
