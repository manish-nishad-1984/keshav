import { prisma } from './prisma';

// Codes that don't reset every fiscal year (Karigar codes, item/style codes, etc.) share this
// constant so they land in one non-resetting NumberSequence row per organization+prefix.
const PERMANENT_FISCAL_YEAR = 'PERM';

// Single atomic upsert (INSERT ... ON CONFLICT DO UPDATE ... RETURNING under the hood) — safe
// under concurrent callers with no explicit locking needed.
export const nextSequenceCode = async (organizationId: string, prefix: string, padTo = 3): Promise<string> => {
  const seq = await prisma.numberSequence.upsert({
    where: { organizationId_prefix_fiscalYear: { organizationId, prefix, fiscalYear: PERMANENT_FISCAL_YEAR } },
    create: { organizationId, prefix, fiscalYear: PERMANENT_FISCAL_YEAR, nextValue: 2, padTo },
    update: { nextValue: { increment: 1 } },
  });
  const used = seq.nextValue - 1;
  return `${prefix}-${String(used).padStart(seq.padTo, '0')}`;
};
