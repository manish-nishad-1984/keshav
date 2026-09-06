export interface ParsedIdentifier {
  kind: 'email' | 'mobile';
  value: string;
}

export const parseLoginIdentifier = (raw: string): ParsedIdentifier => {
  const trimmed = raw.trim();
  if (trimmed.includes('@')) {
    return { kind: 'email', value: trimmed.toLowerCase() };
  }
  return { kind: 'mobile', value: trimmed.replace(/\D/g, '') };
};
