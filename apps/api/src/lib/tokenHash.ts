import { createHash } from 'node:crypto';

export const hashToken = (raw: string): string => createHash('sha256').update(raw).digest('hex');
