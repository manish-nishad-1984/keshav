import type { Request, Response } from 'express';
import { ok } from '../../lib/response';
import { restoreBackupSchema, updateAutoBackupSettingsSchema } from './backup.schema';
import * as service from './backup.service';

export const exportBackup = async (req: Request, res: Response) => {
  const payload = await service.createManualBackup(req.auth!.organizationId, req.auth!.userId);
  ok(res, payload);
};

export const list = async (req: Request, res: Response) => {
  ok(res, await service.listBackups(req.auth!.organizationId));
};

export const download = async (req: Request, res: Response) => {
  const payload = await service.getBackupPayload(req.auth!.organizationId, req.params.id);
  ok(res, payload);
};

export const restore = async (req: Request, res: Response) => {
  const input = restoreBackupSchema.parse(req.body);
  await service.restoreBackup(req.auth!.organizationId, input);
  ok(res, { restored: true });
};

export const getSettings = async (req: Request, res: Response) => {
  ok(res, await service.getAutoBackupSettings(req.auth!.organizationId));
};

export const updateSettings = async (req: Request, res: Response) => {
  const input = updateAutoBackupSettingsSchema.parse(req.body);
  ok(res, await service.updateAutoBackupSettings(req.auth!.organizationId, input));
};
