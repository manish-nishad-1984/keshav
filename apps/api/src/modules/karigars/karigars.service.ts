import { conflict, notFound } from '../../lib/httpError';
import { prisma } from '../../lib/prisma';
import { getEarningsByKarigar, getPaidByKarigar } from '../payments/earnings';
import { computePositions } from '../accessory-issues/accessory-positions';
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

// A karigar who still holds pieces or accessories, or is owed money, can't be deleted: they would
// vanish from the ledger together with the balance. They can be made inactive instead.
export const deleteKarigar = async (organizationId: string, id: string, actorId: string | null) => {
  const karigar = await getKarigar(organizationId, id);
  const [given, made, earnings, paid, positions] = await Promise.all([
    prisma.cuttingDistribution.aggregate({ where: { karigarId: id }, _sum: { totalQuantity: true } }),
    prisma.productionEntry.aggregate({ where: { carrierId: id, deletedAt: null }, _sum: { carrierQuantity: true } }),
    getEarningsByKarigar(organizationId),
    getPaidByKarigar(organizationId),
    computePositions(prisma, organizationId, { karigarId: id }),
  ]);
  const problems: string[] = [];
  const pieces = (given._sum.totalQuantity ?? 0) - (made._sum.carrierQuantity ?? 0);
  if (pieces > 0) problems.push(`${pieces} pieces are still with them (not handed in)`);
  const owed = (earnings.get(id)?.total ?? 0) - (paid.get(id) ?? 0);
  if (owed > 0.005) problems.push(`₹${owed.toLocaleString('en-IN', { maximumFractionDigits: 2 })} is still to be paid`);
  if (positions.some((p) => p.lines.some((l) => l.holding > 0.0005))) problems.push('they still hold accessories');
  if (problems.length) {
    throw conflict(`${karigar.fullName} can't be deleted: ${problems.join('; ')}. Settle that first, or mark the karigar inactive instead.`);
  }
  await repo.softDeleteKarigar(id, actorId);
};
