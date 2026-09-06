export type StatusTone = 'neutral' | 'info' | 'progress' | 'success' | 'warning' | 'danger' | 'muted';

export interface StatusDescriptor {
  label: string;
  tone: StatusTone;
}

const TONE_PATTERNS: [RegExp, StatusTone][] = [
  [/ACTIVE|APPROVED|COMPLETED|PAID/, 'success'],
  [/REJECTED|FAILED|CANCELLED|CANCELED|DISABLED|SUSPENDED/, 'danger'],
  [/IN_PROGRESS|PROCESSING/, 'progress'],
  [/WARNING|LOCKED/, 'warning'],
  [/PENDING|DRAFT|INVITED/, 'neutral'],
];

const titleCase = (value: string) =>
  value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

export const describeStatus = (status: string): StatusDescriptor => {
  const upper = status.toUpperCase();
  const match = TONE_PATTERNS.find(([pattern]) => pattern.test(upper));
  return {
    label: titleCase(status),
    tone: match ? match[1] : 'neutral',
  };
};
