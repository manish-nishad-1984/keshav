import bcrypt from 'bcryptjs';
import { env } from './env';

export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, env.BCRYPT_ROUNDS);

export const comparePassword = (plain: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plain, hash);
