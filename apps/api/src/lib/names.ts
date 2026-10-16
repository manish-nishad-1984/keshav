import { z } from 'zod';

// Karigar, party, design and work type names are always saved in CAPITAL letters with single spaces,
// whatever the user typed, so "ramesh  bhai" and "RAMESH BHAI" are the same name.
export const normalizeName = (value: string) => value.trim().replace(/\s+/g, ' ').toUpperCase();

export const nameSchema = z
  .string()
  .trim()
  .min(1)
  .max(150)
  .transform(normalizeName);
