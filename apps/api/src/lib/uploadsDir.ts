import fs from 'node:fs';
import path from 'node:path';

export const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
