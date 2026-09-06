import * as repo from './organization.repository';
import type { UpdateOrganizationInput } from './organization.schema';

export const getOrganization = (organizationId: string) => repo.findOrganizationById(organizationId);

export const updateOrganization = (organizationId: string, input: UpdateOrganizationInput, actorId: string | null) =>
  repo.updateOrganization(organizationId, input, actorId);
