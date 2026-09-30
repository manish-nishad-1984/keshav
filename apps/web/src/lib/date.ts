// App-wide date formatting: every date shown to the user is DD-MM-YYYY.
//
// Two kinds of value flow through the app:
//  - Date-only fields (production/cutting/payment date, join date) arrive from the API as
//    "YYYY-MM-DD" or "YYYY-MM-DDT00:00:00.000Z". Their calendar day is the first 10 characters —
//    they are read as plain strings, never via `new Date(...)`, which would shift the day in
//    time zones behind UTC.
//  - Timestamps (createdAt, lastLoginAt) are real instants, shown in the viewer's local time.
//
// Inside forms, date values stay in ISO "YYYY-MM-DD" (what the API expects); only the display
// and the typed text are DD-MM-YYYY.

const pad = (n: number) => String(n).padStart(2, '0');

export const toIsoDate = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;

/** Local calendar date of `d` as "YYYY-MM-DD" (not UTC, unlike toISOString). */
export const localIsoDate = (d: Date = new Date()) => toIsoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());

export const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

/** Splits an ISO date(-time) string into its calendar parts, or null if it isn't one. */
export const parseIsoDate = (value: string | null | undefined) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
};

/** Date-only value → "DD-MM-YYYY" ('' when empty/invalid). */
export const formatDate = (value: string | null | undefined) => {
  const parts = parseIsoDate(value);
  return parts ? `${pad(parts.day)}-${pad(parts.month)}-${parts.year}` : '';
};

/** Timestamp → "DD-MM-YYYY HH:mm" in local time. */
export const formatDateTime = (value: string | Date | null | undefined) => {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Typed "DD-MM-YYYY" → ISO "YYYY-MM-DD", or null if incomplete/invalid. */
export const parseDisplayDate = (text: string) => {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(text.trim());
  if (!match) return null;
  const iso = toIsoDate(Number(match[3]), Number(match[2]), Number(match[1]));
  return parseIsoDate(iso) ? iso : null;
};

/** Formats raw keystrokes as DD-MM-YYYY, inserting the dashes automatically. */
export const maskDisplayDate = (text: string) => {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
};
