import { prisma } from '../../lib/prisma';
import type { CreatePartyInput, UpdatePartyInput } from './parties.schema';

export const listParties = (organizationId: string) =>
  prisma.party.findMany({ where: { organizationId }, orderBy: { name: 'asc' } });

export const findPartyById = (organizationId: string, id: string) =>
  prisma.party.findFirst({ where: { id, organizationId } });

export const findPartyByName = (organizationId: string, name: string) =>
  prisma.party.findFirst({ where: { organizationId, name: { equals: name, mode: 'insensitive' } } });

export const createParty = (organizationId: string, data: CreatePartyInput, createdById: string | null) =>
  prisma.party.create({ data: { organizationId, ...data, createdById: createdById ?? undefined } });

export const updateParty = (id: string, data: UpdatePartyInput, updatedById: string | null) =>
  prisma.party.update({ where: { id }, data: { ...data, updatedById: updatedById ?? undefined } });

// Counts soft-deleted cutting entries too: they still hold a real FK to the party.
export const countCuttingEntriesForParty = (partyId: string) => prisma.cuttingEntry.count({ where: { partyId } });

export const deleteParty = (id: string) => prisma.party.delete({ where: { id } });
