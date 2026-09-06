import { notFound } from '../../lib/httpError';
import { nextSequenceCode } from '../../lib/numberSequence';
import * as repo from './karigars.repository';
import type { CreateKarigarInput, ListKarigarsQuery, UpdateKarigarInput } from './karigars.schema';

export const listKarigars = (organizationId: string, query: ListKarigarsQuery) =>
  repo.listKarigars(organizationId, query.page, query.pageSize, query.search, query.workTypeId);

export const getKarigar = async (organizationId: string, id: string) => {
  const karigar = await repo.findKarigarById(organizationId, id);
  if (!karigar) throw notFound('Karigar not found');
  return karigar;
};

export const createKarigar = async (organizationId: string, input: CreateKarigarInput, actorId: string | null) => {
  const code = await nextSequenceCode(organizationId, 'KRG');
  return repo.createKarigar(organizationId, code, input, actorId);
};

export const updateKarigar = async (
  organizationId: string,
  id: string,
  input: UpdateKarigarInput,
  actorId: string | null,
) => {
  await getKarigar(organizationId, id);
  return repo.updateKarigar(id, input, actorId);
};

export const deleteKarigar = async (organizationId: string, id: string, actorId: string | null) => {
  await getKarigar(organizationId, id);
  await repo.softDeleteKarigar(id, actorId);
};
