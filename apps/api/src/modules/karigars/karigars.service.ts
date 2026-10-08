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
  const { documents, ...data } = input;
  const karigar = await repo.createKarigar(organizationId, code, data, actorId);
  if (documents?.length) await repo.replaceKarigarDocuments(karigar.id, documents);
  return getKarigar(organizationId, karigar.id);
};

export const updateKarigar = async (
  organizationId: string,
  id: string,
  input: UpdateKarigarInput,
  actorId: string | null,
) => {
  await getKarigar(organizationId, id);
  const { documents, ...data } = input;
  await repo.updateKarigar(id, data, actorId);
  if (documents) await repo.replaceKarigarDocuments(id, documents);
  return getKarigar(organizationId, id);
};

export const deleteKarigar = async (organizationId: string, id: string, actorId: string | null) => {
  await getKarigar(organizationId, id);
  await repo.softDeleteKarigar(id, actorId);
};
