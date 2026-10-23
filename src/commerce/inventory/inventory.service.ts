// Commerce inventory domain service.

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../../core/auth/strategies/jwt.strategy';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  CreateProductDto,
  CreateWarehouseDto,
  CreateReceiptDto,
  CreateIssueDto,
  CreateTransferDto,
} from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireAccess(user: AuthenticatedUser, manage = false) {
    if (!user?.organizationId) {
      throw new ForbiddenException('کاربر به سازمان فعالی دسترسی ندارد.');
    }
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId: user.organizationId,
        userId: user.id,
        status: 'ACTIVE',
        organization: { status: 'ACTIVE' },
      },
      select: {
        organization: { select: { ownerId: true } },
        roles: {
          select: {
            role: {
              select: {
                key: true,
                permissions: {
                  select: { permission: { select: { key: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!membership) {
      throw new ForbiddenException('عضویت فعال سازمان لازم است.');
    }

    const isAdministrator =
      membership.organization.ownerId === user.id ||
      membership.roles.some(({ role }) =>
        ['ADMIN', 'SUPER_ADMIN'].includes(role.key.toUpperCase()),
      );
    const permissionKeys = new Set(
      membership.roles.flatMap(({ role }) =>
        role.permissions.map(({ permission }) => permission.key),
      ),
    );
    const allowed = manage
      ? isAdministrator || permissionKeys.has('inventory.write')
      : isAdministrator ||
        permissionKeys.has('inventory.read') ||
        permissionKeys.has('inventory.write');

    if (!allowed) {
      throw new ForbiddenException(
        manage
          ? 'مجوز مدیریت انبار را ندارید.'
          : 'مجوز مشاهده انبار را ندارید.',
      );
    }
    return user.organizationId;
  }

  private async assertOwnedReferences(
    tx: Prisma.TransactionClient,
    organizationId: string,
    warehouseIds: string[],
    productIds: string[],
  ) {
    const [warehouses, products] = await Promise.all([
      warehouseIds.length
        ? tx.warehouse.count({
            where: {
              id: { in: [...new Set(warehouseIds)] },
              organizationId,
              isActive: true,
            },
          })
        : 0,
      productIds.length
        ? tx.product.count({
            where: {
              id: { in: [...new Set(productIds)] },
              organizationId,
              isActive: true,
            },
          })
        : 0,
    ]);

    if (
      warehouses !== new Set(warehouseIds).size ||
      products !== new Set(productIds).size
    ) {
      throw new BadRequestException(
        'کالا یا انبار انتخاب‌شده معتبر نیست یا به سازمان جاری تعلق ندارد.',
      );
    }
  }

  async getSummary(user: AuthenticatedUser) {
    const organizationId = await this.requireAccess(user);
    const activeProducts = await this.prisma.product.count({
      where: { organizationId, isActive: true },
    });

    const products = await this.prisma.product.findMany({
      where: { organizationId, isActive: true },
      include: { balances: true },
    });

    let lowStockCount = 0;
    for (const product of products) {
      const totalQty = product.balances.reduce((sum, b) => sum + b.quantity, 0);
      if (totalQty <= product.minStockLevel) {
        lowStockCount++;
      }
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayReceipts = await this.prisma.inventoryMovement.count({
      where: {
        organizationId,
        type: 'RECEIPT',
        createdAt: { gte: startOfToday },
      },
    });

    const todayIssues = await this.prisma.inventoryMovement.count({
      where: {
        organizationId,
        type: 'ISSUE',
        createdAt: { gte: startOfToday },
      },
    });

    return {
      activeProducts,
      lowStockCount,
      todayReceipts,
      todayIssues,
    };
  }

  async getProducts(user: AuthenticatedUser) {
    const organizationId = await this.requireAccess(user);
    return this.prisma.product.findMany({
      where: { organizationId },
      include: { balances: { include: { warehouse: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createProduct(user: AuthenticatedUser, dto: CreateProductDto) {
    const organizationId = await this.requireAccess(user, true);
    return this.prisma.product.create({
      data: {
        ...dto,
        organizationId,
      },
    });
  }

  async getWarehouses(user: AuthenticatedUser) {
    const organizationId = await this.requireAccess(user);
    return this.prisma.warehouse.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createWarehouse(user: AuthenticatedUser, dto: CreateWarehouseDto) {
    const organizationId = await this.requireAccess(user, true);
    return this.prisma.warehouse.create({
      data: {
        ...dto,
        organizationId,
      },
    });
  }

  async getBalances(user: AuthenticatedUser) {
    const organizationId = await this.requireAccess(user);
    return this.prisma.inventoryBalance.findMany({
      where: {
        warehouse: { organizationId },
      },
      include: {
        product: true,
        warehouse: true,
      },
    });
  }

  async getMovements(user: AuthenticatedUser) {
    const organizationId = await this.requireAccess(user);
    return this.prisma.inventoryMovement.findMany({
      where: { organizationId },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async createReceipt(user: AuthenticatedUser, dto: CreateReceiptDto) {
    const organizationId = await this.requireAccess(user, true);
    return this.prisma.$transaction(async (tx) => {
      await this.assertOwnedReferences(
        tx,
        organizationId,
        [dto.warehouseId],
        dto.items.map((item) => item.productId),
      );
      const movement = await tx.inventoryMovement.create({
        data: {
          organizationId,
          type: 'RECEIPT',
          toWarehouseId: dto.warehouseId,
          referenceNumber: dto.referenceNumber,
          notes: dto.notes,
          items: {
            create: dto.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
          },
        },
      });

      for (const item of dto.items) {
        await tx.inventoryBalance.upsert({
          where: {
            productId_warehouseId: {
              productId: item.productId,
              warehouseId: dto.warehouseId,
            },
          },
          create: {
            productId: item.productId,
            warehouseId: dto.warehouseId,
            quantity: item.quantity,
          },
          update: {
            quantity: { increment: item.quantity },
          },
        });
      }

      return movement;
    });
  }

  async createIssue(user: AuthenticatedUser, dto: CreateIssueDto) {
    const organizationId = await this.requireAccess(user, true);
    return this.prisma.$transaction(async (tx) => {
      await this.assertOwnedReferences(
        tx,
        organizationId,
        [dto.warehouseId],
        dto.items.map((item) => item.productId),
      );
      for (const item of dto.items) {
        const result = await tx.inventoryBalance.updateMany({
          where: {
            productId: item.productId,
            warehouseId: dto.warehouseId,
            quantity: { gte: item.quantity },
          },
          data: { quantity: { decrement: item.quantity } },
        });
        if (result.count !== 1) {
          throw new BadRequestException(
            `موجودی کالا برای خروج کافی نیست (شناسه کالا: ${item.productId})`,
          );
        }
      }

      const movement = await tx.inventoryMovement.create({
        data: {
          organizationId,
          type: 'ISSUE',
          fromWarehouseId: dto.warehouseId,
          referenceNumber: dto.referenceNumber,
          notes: dto.notes,
          items: {
            create: dto.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
          },
        },
      });

      return movement;
    });
  }

  async createTransfer(user: AuthenticatedUser, dto: CreateTransferDto) {
    const organizationId = await this.requireAccess(user, true);
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException('انبار مبدا و مقصد نمی‌توانند یکسان باشند');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.assertOwnedReferences(
        tx,
        organizationId,
        [dto.fromWarehouseId, dto.toWarehouseId],
        dto.items.map((item) => item.productId),
      );
      for (const item of dto.items) {
        const result = await tx.inventoryBalance.updateMany({
          where: {
            productId: item.productId,
            warehouseId: dto.fromWarehouseId,
            quantity: { gte: item.quantity },
          },
          data: { quantity: { decrement: item.quantity } },
        });
        if (result.count !== 1) {
          throw new BadRequestException(
            `موجودی در انبار مبدا کافی نیست (شناسه کالا: ${item.productId})`,
          );
        }
      }

      const movement = await tx.inventoryMovement.create({
        data: {
          organizationId,
          type: 'TRANSFER',
          fromWarehouseId: dto.fromWarehouseId,
          toWarehouseId: dto.toWarehouseId,
          referenceNumber: dto.referenceNumber,
          notes: dto.notes,
          items: {
            create: dto.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
          },
        },
      });

      for (const item of dto.items) {
        // افزایش به مقصد
        await tx.inventoryBalance.upsert({
          where: {
            productId_warehouseId: {
              productId: item.productId,
              warehouseId: dto.toWarehouseId,
            },
          },
          create: {
            productId: item.productId,
            warehouseId: dto.toWarehouseId,
            quantity: item.quantity,
          },
          update: {
            quantity: { increment: item.quantity },
          },
        });
      }

      return movement;
    });
  }
}
