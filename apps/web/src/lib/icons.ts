import * as icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const resolveIcon = (name: string): LucideIcon =>
  (icons as unknown as Record<string, LucideIcon>)[name] ?? icons.Circle;
