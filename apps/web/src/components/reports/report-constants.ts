export type ReportKey =
  | 'daily-production'
  | 'karigar-summary'
  | 'item-summary'
  | 'payment-report'
  | 'monthly-summary'
  | 'photo-report';

export interface ReportDefinition {
  key: ReportKey;
  title: string;
  description: string;
  icon: string;
  usesDateRange: boolean;
}

export const REPORT_TYPES: ReportDefinition[] = [
  {
    key: 'daily-production',
    title: 'Daily Production Report',
    description: 'Date-wise garment production',
    icon: 'CalendarDays',
    usesDateRange: true,
  },
  {
    key: 'karigar-summary',
    title: 'Karigar-wise Report',
    description: 'Individual karigar summary',
    icon: 'Users',
    usesDateRange: true,
  },
  {
    key: 'item-summary',
    title: 'Item / Style Report',
    description: 'Style-wise production summary',
    icon: 'Shirt',
    usesDateRange: true,
  },
  {
    key: 'payment-report',
    title: 'Payment Report',
    description: 'Paid / Pending details',
    icon: 'Wallet',
    usesDateRange: false,
  },
  {
    key: 'monthly-summary',
    title: 'Monthly Summary',
    description: 'Month-wise total production',
    icon: 'CalendarRange',
    usesDateRange: true,
  },
  {
    key: 'photo-report',
    title: 'Photo Report',
    description: 'Production with photos',
    icon: 'Images',
    usesDateRange: true,
  },
];

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// `monthKey` is a plain "YYYY-MM" string (see reports.repository.ts on the API side for why) —
// parsed manually here rather than via `new Date(...)` to avoid the same timezone pitfall.
export const formatMonthKey = (monthKey: string) => {
  const [year, month] = monthKey.split('-').map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
};
