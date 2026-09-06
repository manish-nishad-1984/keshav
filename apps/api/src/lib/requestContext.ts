import { AsyncLocalStorage } from 'node:async_hooks';
import type { PermissionKey } from '@ckfast/types';

export interface RequestContext {
  requestId: string;
  actorId: string | null;
  actorEmail: string | null;
  organizationId: string | null;
  permissions: ReadonlySet<PermissionKey>;
  isSuperAdmin: boolean;
  ipAddress: string | null;
  userAgent: string | null;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const emptyContext = (overrides: Partial<RequestContext> = {}): RequestContext => ({
  requestId: overrides.requestId ?? '',
  actorId: null,
  actorEmail: null,
  organizationId: null,
  permissions: new Set(),
  isSuperAdmin: false,
  ipAddress: null,
  userAgent: null,
  ...overrides,
});

export const runWithContext = <T>(context: RequestContext, fn: () => T): T =>
  storage.run(context, fn);

export const getContext = (): RequestContext => {
  const context = storage.getStore();
  if (!context) {
    throw new Error('Request context accessed outside of a request scope');
  }
  return context;
};

export const getActorId = (): string | null => getContext().actorId;
export const getOrganizationId = (): string | null => getContext().organizationId;
export const getRequestId = (): string => getContext().requestId;

export const actorCan = (permission: PermissionKey): boolean => {
  const context = getContext();
  return context.isSuperAdmin || context.permissions.has(permission);
};

export const setContextActor = (actor: {
  actorId: string;
  actorEmail: string;
  organizationId: string;
  permissions: ReadonlySet<PermissionKey>;
  isSuperAdmin: boolean;
}): void => {
  const context = getContext();
  context.actorId = actor.actorId;
  context.actorEmail = actor.actorEmail;
  context.organizationId = actor.organizationId;
  context.permissions = actor.permissions;
  context.isSuperAdmin = actor.isSuperAdmin;
};

export const auditCreate = () => ({ createdById: getActorId() });
export const auditUpdate = () => ({ updatedById: getActorId() });
