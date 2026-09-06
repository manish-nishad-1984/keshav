import { randomBytes } from 'node:crypto';
import { conflict, notFound } from '../../lib/httpError';
import { hashPassword } from '../../lib/password';
import * as repo from './users.repository';
import type { CreateUserInput, SetUserStatusInput, UpdateUserInput } from './users.schema';

export const listUsers = async (organizationId: string, page: number, pageSize: number, search?: string) =>
  repo.listUsers(organizationId, page, pageSize, search);

export const getUser = async (organizationId: string, id: string) => {
  const user = await repo.findUserById(organizationId, id);
  if (!user) throw notFound('User not found');
  return user;
};

export const createUser = async (organizationId: string, input: CreateUserInput, actorId: string | null) => {
  const existing = await repo.findUserByEmail(input.email);
  if (existing) throw conflict('A user with this email already exists');

  const passwordHash = await hashPassword(input.password);
  return repo.createUser(
    organizationId,
    {
      fullName: input.fullName,
      email: input.email,
      mobile: input.mobile,
      branchId: input.branchId,
      employeeCode: input.employeeCode,
      designation: input.designation,
      passwordHash,
      roleIds: input.roleIds,
    },
    actorId,
  );
};

export const updateUser = async (organizationId: string, id: string, input: UpdateUserInput, actorId: string | null) => {
  await getUser(organizationId, id);
  return repo.updateUser(organizationId, id, input, actorId);
};

export const deleteUser = async (organizationId: string, id: string, actorId: string | null) => {
  await getUser(organizationId, id);
  await repo.softDeleteUser(id, actorId);
};

export const setStatus = async (organizationId: string, id: string, input: SetUserStatusInput, actorId: string | null) => {
  await getUser(organizationId, id);
  return repo.setStatus(organizationId, id, input.status, actorId);
};

// Generates a one-time temporary password shown to the admin once — never stored or logged in
// plain text, and mustChangePassword forces the user to set their own on next sign-in.
export const resetPassword = async (organizationId: string, id: string) => {
  await getUser(organizationId, id);
  const temporaryPassword = randomBytes(9).toString('base64url');
  const passwordHash = await hashPassword(temporaryPassword);
  await repo.resetPassword(id, passwordHash);
  return { temporaryPassword };
};
