import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../../lib/env';

// The WhatsApp token is saved encrypted (AES-256-GCM). The key comes from a server secret that is
// not in the database, so a copy of the database alone does not reveal the token.
const key = () => createHash('sha256').update(`whatsapp-token:${env.JWT_REFRESH_SECRET}`).digest();

export const encryptSecret = (plain: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
};

export const decryptSecret = (packed: string): string | null => {
  try {
    const [iv, tag, data] = packed.split('.').map((p) => Buffer.from(p, 'base64'));
    const decipher = createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
};
