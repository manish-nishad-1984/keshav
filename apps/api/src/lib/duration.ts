const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export const parseDurationMs = (value: string): number => {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration string: ${value}`);
  }
  const [, amount, unit] = match;
  return Number(amount) * UNIT_MS[unit];
};
