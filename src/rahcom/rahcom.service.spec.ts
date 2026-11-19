import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import type { AuthenticatedUser } from '../core/auth/jwt.strategy';
import { RahcomService } from './rahcom.service';

describe('RahcomService activity access', () => {
  const user: AuthenticatedUser = {
    id: 'member-1',
    username: 'operator',
    email: null,
    firstName: 'Test',
    lastName: 'Operator',
    status: 'ACTIVE',
    isSystemUser: false,
    organizationId: 'org-1',
  };

  function createService(activityOverrides: Record<string, unknown> = {}) {
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      organizationMember: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'membership-1',
          rahcomProvince: 'isfahan',
          rahcomSelectedProvince: 'isfahan',
          organization: { ownerId: 'owner-1' },
          roles: [{ role: { key: 'OPERATOR', permissions: [] } }],
        }),
      },
      rahcomActivity: {
        findFirst: jest.fn().mockResolvedValue({
          systemId: 'system-1',
          createdById: user.id,
          provinceSnapshot: 'isfahan',
          system: { province: 'isfahan' },
          ...activityOverrides,
        }),
        deleteMany,
      },
    } as unknown as PrismaService;

    return { service: new RahcomService(prisma), deleteMany };
  }

  it('rechecks ownership and province in the atomic delete predicate', async () => {
    const { service, deleteMany } = createService();

    await expect(service.deleteActivity(user, 'activity-1')).resolves.toEqual({
      deleted: true,
    });

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'activity-1',
        organizationId: 'org-1',
        createdById: user.id,
        OR: [{ system: { province: 'isfahan' } }],
      },
    });
  });

  it('keeps system-less activities scoped to their province snapshot', async () => {
    const { service, deleteMany } = createService({
      systemId: null,
      provinceSnapshot: 'isfahan',
      system: null,
    });

    await service.deleteActivity(user, 'activity-2');

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'activity-2',
        organizationId: 'org-1',
        createdById: user.id,
        OR: [{ provinceSnapshot: 'isfahan' }],
      },
    });
  });

  it('rejects deletion by a different activity creator', async () => {
    const { service, deleteMany } = createService({ createdById: 'member-2' });

    await expect(service.deleteActivity(user, 'activity-3')).rejects.toThrow(
      ForbiddenException,
    );
    expect(deleteMany).not.toHaveBeenCalled();
  });
});
