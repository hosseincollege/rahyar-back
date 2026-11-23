import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import type { AuthenticatedUser } from '../core/auth/jwt.strategy';
import { CreateBusinessTripDto } from './create-business-trip.dto';

@Injectable()
export class BusinessTripsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getEmployeeId(user: AuthenticatedUser): Promise<string> {
    const organizationId = user.organizationId;
    if (!organizationId) {
      throw new BadRequestException('An active organization is required.');
    }

    const employee = await this.prisma.employee.findFirst({
      where: {
        organizationId,
        userId: user.id,
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    if (!employee) {
      throw new ForbiddenException(
        'An active employee profile linked to this account is required.',
      );
    }

    return employee.id;
  }

  async listMine(user: AuthenticatedUser) {
    const organizationId = user.organizationId;
    if (!organizationId) {
      throw new BadRequestException('An active organization is required.');
    }
    const employeeId = await this.getEmployeeId(user);

    return this.prisma.businessTripRequest.findMany({
      where: { organizationId, employeeId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        destination: true,
        purpose: true,
        startAt: true,
        endAt: true,
        estimatedCost: true,
        currency: true,
        status: true,
        reviewerNote: true,
        createdAt: true,
      },
    });
  }

  async create(dto: CreateBusinessTripDto, user: AuthenticatedUser) {
    const organizationId = user.organizationId;
    if (!organizationId) {
      throw new BadRequestException('An active organization is required.');
    }
    const employeeId = await this.getEmployeeId(user);
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (startAt >= endAt) {
      throw new BadRequestException('The trip end must be after its start.');
    }

    return this.prisma.businessTripRequest.create({
      data: {
        organizationId,
        employeeId,
        destination: dto.destination.trim(),
        purpose: dto.purpose.trim(),
        startAt,
        endAt,
        estimatedCost: dto.estimatedCost,
      },
      select: {
        id: true,
        destination: true,
        purpose: true,
        startAt: true,
        endAt: true,
        estimatedCost: true,
        currency: true,
        status: true,
        reviewerNote: true,
        createdAt: true,
      },
    });
  }
}
