import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../lib/asyncHandler';
import { badRequest } from '../../lib/httpError';
import { ok } from '../../lib/response';
import { UPLOADS_DIR } from '../../lib/uploadsDir';

// PDF: the delivery challan, uploaded so the WhatsApp service can attach it.
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      cb(badRequest('Only JPG, PNG, WEBP images or a PDF are allowed'));
      return;
    }
    cb(null, true);
  },
});

export const uploadsRouter = Router();

// Any authenticated user may attach a photo to a record they otherwise have permission to
// edit — the permission check happens on the record's own create/update route, not here.
uploadsRouter.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('No file uploaded');
    ok(res, { url: `/uploads/${req.file.filename}` }, 201);
  }),
);
