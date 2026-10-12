import { notFound } from '../../lib/httpError';
import { prisma } from '../../lib/prisma';
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

// A karigar with no entries at all is removed permanently. One with any history (distribution,
// production, payment, accessories, press) is made inactive instead, so the history stays readable.
export const deleteKarigar = async (organizationId: string, id: string, actorId: string | null) => {
  await getKarigar(organizationId, id);
  const [distributions, production, payments, accessories, press] = await Promise.all([
    prisma.cuttingDistribution.count({ where: { karigarId: id } }),
    prisma.productionEntry.count({
      where: { OR: [{ carrierId: id }, { overlockCarrierId: id }, { flatlockKarigarId: id }] },
    }),
    prisma.payment.count({ where: { karigarId: id } }),
    prisma.accessoryTransaction.count({ where: { karigarId: id } }),
    prisma.pressEntry.count({ where: { karigarId: id } }),
    prisma.sampleEntry.count({ where: { karigarId: id } }),
  ]);
  if (distributions + production + payments + accessories + press > 0) {
    await repo.updateKarigar(id, { isActive: false }, actorId);
    return { deleted: false, deactivated: true };
  }
  await repo.hardDeleteKarigar(id);
  return { deleted: true, deactivated: false };
};
