import { notFound } from '../../lib/httpError';
import { getKarigar } from '../karigars/karigars.service';
import * as repo from './payments.repository';
import type { CreatePaymentInput, ListPaymentsQuery, UpdatePaymentInput } from './payments.schema';

export const listPayments = (organizationId: string, query: ListPaymentsQuery) =>
  repo.listPayments(organizationId, query.page, query.pageSize, query.karigarId);

export const getPayment = async (organizationId: string, id: string) => {
  const payment = await repo.findPaymentById(organizationId, id);
  if (!payment) throw notFound('Payment not found');
  return payment;
};

export const createPayment = async (organizationId: string, input: CreatePaymentInput, actorId: string | null) => {
  await getKarigar(organizationId, input.karigarId);
  return repo.createPayment(organizationId, input, actorId);
};

export const updatePayment = async (
  organizationId: string,
  id: string,
  input: UpdatePaymentInput,
  actorId: string | null,
) => {
  await getPayment(organizationId, id);
  if (input.karigarId) await getKarigar(organizationId, input.karigarId);
  return repo.updatePayment(id, input, actorId);
};

export const deletePayment = async (organizationId: string, id: string, actorId: string | null) => {
  await getPayment(organizationId, id);
  await repo.softDeletePayment(id, actorId);
};

export const getLedger = (organizationId: string) => repo.getLedger(organizationId);
