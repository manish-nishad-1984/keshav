import { prisma } from '../../lib/prisma';

export const findOrganizationById = (id: string) => prisma.organization.findUniqueOrThrow({ where: { id } });

export const updateOrganization = (
  id: string,
  data: Partial<{
    name: string;
    ownerName: string;
    gstNumber: string;
    email: string;
    phone: string;
    addressLine1: string;
    logoUrl: string | null;
    currency: string;
    timezone: string;
    fiscalYearStartMonth: number;
  }>,
  updatedById: string | null,
) => prisma.organization.update({ where: { id }, data: { ...data, updatedById: updatedById ?? undefined } });
