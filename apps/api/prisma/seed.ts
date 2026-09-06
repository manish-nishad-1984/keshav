import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedPermissions, seedRoles } from './seed/access';

const prisma = new PrismaClient();

const env = {
  orgCode: process.env.SEED_ORG_CODE ?? 'CKFAST',
  companyName: process.env.SEED_COMPANY_NAME ?? 'CK Fast',
  adminEmail: process.env.SEED_ADMIN_EMAIL ?? 'admin@ckfast.local',
  adminPassword: process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!',
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? 12),
};

const seedOrganization = async () => {
  const organization = await prisma.organization.upsert({
    where: { code: env.orgCode },
    create: { code: env.orgCode, name: env.companyName },
    update: { name: env.companyName },
  });

  await prisma.branch.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: 'HO' } },
    create: {
      organizationId: organization.id,
      code: 'HO',
      name: 'Head Office',
      isHeadOffice: true,
    },
    update: { isHeadOffice: true },
  });

  return organization;
};

const seedAdmin = async (organizationId: string, superAdminRoleId: string) => {
  const passwordHash = await bcrypt.hash(env.adminPassword, env.bcryptRounds);

  const admin = await prisma.user.upsert({
    where: { email: env.adminEmail.toLowerCase() },
    create: {
      organizationId,
      fullName: 'Super Admin',
      email: env.adminEmail.toLowerCase(),
      passwordHash,
      isSuperAdmin: true,
      mustChangePassword: true,
      status: 'ACTIVE',
    },
    update: {},
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: superAdminRoleId } },
    create: { userId: admin.id, roleId: superAdminRoleId },
    update: {},
  });

  return admin;
};

const main = async () => {
  const permissionIds = await seedPermissions(prisma);
  const organization = await seedOrganization();
  await seedRoles(prisma, organization.id, permissionIds);

  const superAdminRole = await prisma.role.findUniqueOrThrow({
    where: { organizationId_slug: { organizationId: organization.id, slug: 'super_admin' } },
  });

  await seedAdmin(organization.id, superAdminRole.id);

  console.log(`Seeded organization "${organization.name}" (${organization.code})`);
  console.log(`Seeded admin login: ${env.adminEmail} / ${env.adminPassword}`);
};

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
