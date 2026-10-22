import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import type { AuthenticatedUser } from '../core/auth/strategies/jwt.strategy';
import type {
  CreateRahcomActivityDto,
  CreateRahcomSystemActivityDto,
  CreateRahcomSolarSnapshotDto,
  ImportRahcomSystemsDto,
  RahcomActivitiesQueryDto,
  UpdateRahcomSystemDto,
} from './dto/rahcom.dto';

@Injectable()
export class RahcomService {
  private readonly demoSystemPrefix = 'DEMO-RAHCOM-';
  private readonly demoActivityPrefix = 'DEMO-RAHCOM |';
  constructor(private readonly prisma: PrismaService) {}
  private organization(user: AuthenticatedUser) {
    if (!user.organizationId) throw new BadRequestException('No active organization is selected.');
    return user.organizationId;
  }
  private async authorize(user: AuthenticatedUser, write = false) {
    const organizationId = this.organization(user);
    const membership = await this.prisma.organizationMember.findFirst({
      where: { organizationId, userId: user.id, status: 'ACTIVE', organization: { status: 'ACTIVE' } },
      select: {
        organization: { select: { ownerId: true } },
        roles: { select: { role: { select: { key: true, permissions: { select: { permission: { select: { key: true } } } } } } } },
      },
    });
    if (!membership) {
      const ownedOrganization = await this.prisma.organization.findFirst({
        where: { id: organizationId, ownerId: user.id, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!ownedOrganization) throw new ForbiddenException('An active organization membership is required.');
      return { organizationId, demoOnly: false };
    }
    const roles = membership.roles.map(({ role }) => role);
    const demoOnly = roles.some(({ key }) => key.toUpperCase() === 'DEMO_USER');
    if (membership.organization.ownerId === user.id || roles.some(({ key }) => ['ADMIN', 'SUPER_ADMIN'].includes(key.toUpperCase()))) return { organizationId, demoOnly };
    const permissions = new Set(roles.flatMap(({ permissions }) => permissions.map(({ permission }) => permission.key)));
    if (write ? !permissions.has('rahcom.write') : !permissions.has('rahcom.read') && !permissions.has('rahcom.write')) {
      throw new ForbiddenException('You do not have permission to access Rahcom.');
    }
    return { organizationId, demoOnly };
  }
  private validDate(value: unknown) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('Date must use YYYY-MM-DD.');
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new BadRequestException('Invalid date.');
    return date;
  }
  async listSystems(user: AuthenticatedUser, province?: string) {
    const { organizationId, demoOnly } = await this.authorize(user);
    return this.prisma.rahcomSystem.findMany({ where: { organizationId, ...(demoOnly ? { systemCode: { startsWith: this.demoSystemPrefix } } : {}), ...(province ? { province } : {}) }, orderBy: [{ province: 'asc' }, { systemName: 'asc' }] });
  }
  async listSolarSnapshots(user: AuthenticatedUser) {
    const { organizationId } = await this.authorize(user);
    return this.prisma.rahcomSolarSnapshot.findMany({ where: { organizationId }, orderBy: { capturedAt: 'desc' }, take: 100 });
  }
  async createSolarSnapshot(user: AuthenticatedUser, body: CreateRahcomSolarSnapshotDto) {
    const { organizationId } = await this.authorize(user, true);
    const capturedAt = body.capturedAt ? new Date(body.capturedAt) : new Date();
    if (Number.isNaN(capturedAt.getTime())) throw new BadRequestException('Invalid snapshot date and time.');
    return this.prisma.rahcomSolarSnapshot.create({ data: {
      organizationId, createdById: user.id, capturedAt,
      downText: body.downText, unreachableText: body.unreachableText,
      equipmentColumns: [...new Set(body.equipmentColumns.map((item) => item.trim()).filter(Boolean))],
    } });
  }
  async importSystems(user: AuthenticatedUser, body: ImportRahcomSystemsDto) {
    const { organizationId, demoOnly } = await this.authorize(user, true);
    const province = String(body?.province ?? '').trim();
    if (!province || province.length > 80 || !Array.isArray(body?.systems) || body.systems.length > 10000) throw new BadRequestException('Select a province and provide at most 10,000 rows.');
    const rows = body.systems.map((raw, index): {
      organizationId: string; province: string; systemName: string; systemCode: string; latitude: number; longitude: number; axis?: string | null;
      details?: string | null; electricityBillId?: string | null; simIp?: string | null; radarIp?: string | null;
      cameraIp?: string | null; pcIp?: string | null; routerIp?: string | null; laptopIp?: string | null;
      incidentType?: string | null; incidentDetails?: string | null;
    } => {
      const row = raw;
      const systemName = String(row.systemName ?? '').trim();
      const systemCode = String(row.systemCode ?? '').trim();
      const latitude = Number(row.latitude);
      const longitude = Number(row.longitude);
      if (!systemName || !systemCode || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new BadRequestException(`Invalid system row ${index + 1}. Check name, code, latitude and longitude.`);
      if (demoOnly && !systemCode.startsWith(this.demoSystemPrefix)) throw new ForbiddenException('Demo accounts can only import demo Rahcom systems.');
      const optionalData = {
        ...(row.details !== undefined ? { details: this.optionalText(row.details, 1000) } : {}),
        ...(row.axis !== undefined ? { axis: this.optionalText(row.axis, 120) } : {}),
        ...(row.incidentType !== undefined ? { incidentType: row.incidentType } : {}),
        ...(row.incidentDetails !== undefined ? { incidentDetails: this.optionalText(row.incidentDetails, 1000) } : {}),
        ...(row.electricityBillId !== undefined ? { electricityBillId: this.optionalText(row.electricityBillId, 120) } : {}),
        ...(row.simIp !== undefined ? { simIp: this.optionalText(row.simIp, 100) } : {}),
        ...(row.radarIp !== undefined ? { radarIp: this.optionalText(row.radarIp, 100) } : {}),
        ...(row.cameraIp !== undefined ? { cameraIp: this.optionalText(row.cameraIp, 100) } : {}),
        ...(row.pcIp !== undefined ? { pcIp: this.optionalText(row.pcIp, 100) } : {}),
        ...(row.routerIp !== undefined ? { routerIp: this.optionalText(row.routerIp, 100) } : {}),
        ...(row.laptopIp !== undefined ? { laptopIp: this.optionalText(row.laptopIp, 100) } : {}),
      };
      return { organizationId, province, systemName, systemCode, latitude, longitude, ...optionalData };
    });
    const codes = new Set<string>();
    for (const row of rows) { if (codes.has(row.systemCode)) throw new BadRequestException(`Duplicate system code: ${row.systemCode}`); codes.add(row.systemCode); }
    await this.prisma.$transaction(rows.map((row) => {
      const { details, axis, electricityBillId, simIp, radarIp, cameraIp, pcIp, routerIp, laptopIp, incidentType, incidentDetails, ...required } = row;
      const optionalData = { details, axis, electricityBillId, simIp, radarIp, cameraIp, pcIp, routerIp, laptopIp, incidentType, incidentDetails };
      return this.prisma.rahcomSystem.upsert({
        where: { organizationId_province_systemCode: { organizationId, province, systemCode: row.systemCode } },
        update: { ...required, ...Object.fromEntries(Object.entries(optionalData).filter(([, value]) => value !== undefined)) },
        create: { ...required, details: details ?? null, axis: axis ?? null, electricityBillId: electricityBillId ?? null, simIp: simIp ?? null, radarIp: radarIp ?? null, cameraIp: cameraIp ?? null, pcIp: pcIp ?? null, routerIp: routerIp ?? null, laptopIp: laptopIp ?? null, incidentType: incidentType ?? null, incidentDetails: incidentDetails ?? null },
      });
    }));
    return { imported: rows.length };
  }
  async updateSystem(user: AuthenticatedUser, id: string, body: UpdateRahcomSystemDto) {
    const { organizationId, demoOnly } = await this.authorize(user, true);
    if (Object.keys(body).length === 0) throw new BadRequestException('Provide at least one system field to update.');
    const existing = await this.prisma.rahcomSystem.findFirst({ where: { id, organizationId, ...(demoOnly ? { systemCode: { startsWith: this.demoSystemPrefix } } : {}) } });
    if (!existing) throw new NotFoundException('System not found.');
    const systemName = body.systemName === undefined ? existing.systemName : String(body.systemName ?? '').trim();
    const systemCode = body.systemCode === undefined ? existing.systemCode : String(body.systemCode ?? '').trim();
    const latitude = body.latitude === undefined ? existing.latitude : Number(body.latitude);
    const longitude = body.longitude === undefined ? existing.longitude : Number(body.longitude);
    if (!systemName || !systemCode || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new BadRequestException('Invalid system fields.');
    if (demoOnly && !systemCode.startsWith(this.demoSystemPrefix)) throw new ForbiddenException('Demo accounts cannot move systems outside the demo dataset.');
    const optionalData = {
      ...(body.details !== undefined ? { details: this.optionalText(body.details, 1000) } : {}),
      ...(body.axis !== undefined ? { axis: this.optionalText(body.axis, 120) } : {}),
      ...(body.incidentType !== undefined ? { incidentType: body.incidentType } : {}),
      ...(body.incidentDetails !== undefined ? { incidentDetails: this.optionalText(body.incidentDetails, 1000) } : {}),
      ...(body.electricityBillId !== undefined ? { electricityBillId: this.optionalText(body.electricityBillId, 120) } : {}),
      ...(body.simIp !== undefined ? { simIp: this.optionalText(body.simIp, 100) } : {}),
      ...(body.radarIp !== undefined ? { radarIp: this.optionalText(body.radarIp, 100) } : {}),
      ...(body.cameraIp !== undefined ? { cameraIp: this.optionalText(body.cameraIp, 100) } : {}),
      ...(body.pcIp !== undefined ? { pcIp: this.optionalText(body.pcIp, 100) } : {}),
      ...(body.routerIp !== undefined ? { routerIp: this.optionalText(body.routerIp, 100) } : {}),
      ...(body.laptopIp !== undefined ? { laptopIp: this.optionalText(body.laptopIp, 100) } : {}),
    };
    return this.prisma.rahcomSystem.update({ where: { id }, data: { systemName, systemCode, latitude, longitude, ...optionalData } });
  }
  private optionalText(value: unknown, maxLength: number): string | null {
    const text = String(value ?? '').trim();
    return text ? text.slice(0, maxLength) : null;
  }
  async deleteSystem(user: AuthenticatedUser, id: string) {
    const { organizationId, demoOnly } = await this.authorize(user, true);
    const result = await this.prisma.rahcomSystem.deleteMany({ where: { id, organizationId, ...(demoOnly ? { systemCode: { startsWith: this.demoSystemPrefix } } : {}) } });
    if (!result.count) throw new NotFoundException('System not found.');
    return { deleted: true };
  }
  async deleteSystems(user: AuthenticatedUser, input: { province?: string; ids?: string[] }) {
    const { organizationId, demoOnly } = await this.authorize(user, true);
    const province = String(input.province ?? '').trim();
    const ids = Array.isArray(input.ids) ? [...new Set(input.ids.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))] : [];
    if ((!province && !ids.length) || ids.length > 10000) throw new BadRequestException('Select a province or provide up to 10,000 system IDs.');
    const result = await this.prisma.rahcomSystem.deleteMany({ where: { organizationId, ...(demoOnly ? { systemCode: { startsWith: this.demoSystemPrefix } } : {}), ...(province ? { province } : { id: { in: ids } }) } });
    return { deleted: result.count };
  }
  async listActivities(user: AuthenticatedUser, query: RahcomActivitiesQueryDto) {
    const { organizationId, demoOnly } = await this.authorize(user);
    if (!query.date && !query.from && !query.to) throw new BadRequestException('Provide a date or a date range.');
    if (query.date && (query.from || query.to)) throw new BadRequestException('Use either a single date or a date range.');
    const activityDate = query.date ? this.validDate(query.date) : undefined;
    const from = query.from ? this.validDate(query.from) : undefined;
    const to = query.to ? this.validDate(query.to) : undefined;
    if (Boolean(from) !== Boolean(to)) throw new BadRequestException('Both from and to dates are required for a range.');
    if (from && to && from > to) throw new BadRequestException('The start date must be before the end date.');
    const range = from && to ? { gte: from, lt: new Date(to.getTime() + 86_400_000) } : undefined;
    return this.prisma.rahcomActivity.findMany({ where: { organizationId, ...(range ? { activityDate: range } : activityDate ? { activityDate } : {}), ...(demoOnly ? { description: { startsWith: this.demoActivityPrefix } } : {}) }, include: { system: { select: { id: true, systemName: true, systemCode: true, province: true } } }, orderBy: [{ activityDate: 'desc' }, { createdAt: 'desc' }] });
  }
  createActivity(user: AuthenticatedUser, body: CreateRahcomActivityDto) {
    return this.createAuthorizedActivity(user, body);
  }
  private async createAuthorizedActivity(user: AuthenticatedUser, body: CreateRahcomActivityDto) {
    const { organizationId, demoOnly } = await this.authorize(user, true);
    const activityType = String(body.activityType ?? '').trim();
    const quantity = Number(body.quantity);
    const allowed = ['EMAIL_SENT', 'SYSTEM_VISIT', 'OTHER'];
    if (!allowed.includes(activityType) || !Number.isInteger(quantity) || quantity < 1 || quantity > 100000) throw new BadRequestException('Invalid activity type or quantity.');
    const systemId = body.systemId ? String(body.systemId).trim() : null;
    if (systemId) return this.createVisitRecord(user, organizationId, systemId, body, demoOnly);
    const description = body.description ? String(body.description).slice(0, 1000) : null;
    return this.prisma.rahcomActivity.create({ data: { organizationId, createdById: user.id, performedBy: `${user.firstName} ${user.lastName}`.trim() || user.username, activityDate: this.validDate(body.date), activityType, quantity, description: demoOnly && description ? `${this.demoActivityPrefix} ${description}` : description } });
  }
  async listSystemActivities(user: AuthenticatedUser, systemId: string) {
    const { organizationId, demoOnly } = await this.authorize(user);
    const system = await this.prisma.rahcomSystem.findFirst({ where: { id: systemId, organizationId, ...(demoOnly ? { systemCode: { startsWith: this.demoSystemPrefix } } : {}) }, select: { id: true } });
    if (!system) throw new NotFoundException('System not found.');
    return this.prisma.rahcomActivity.findMany({ where: { organizationId, systemId, ...(demoOnly ? { description: { startsWith: this.demoActivityPrefix } } : {}) }, orderBy: [{ activityDate: 'desc' }, { createdAt: 'desc' }] });
  }
  async createSystemActivity(user: AuthenticatedUser, systemId: string, body: CreateRahcomSystemActivityDto) {
    const { organizationId, demoOnly } = await this.authorize(user, true);
    return this.createVisitRecord(user, organizationId, systemId, body, demoOnly);
  }
  private async createVisitRecord(user: AuthenticatedUser, organizationId: string, systemId: string, body: CreateRahcomActivityDto | CreateRahcomSystemActivityDto, demoOnly = false) {
    const system = await this.prisma.rahcomSystem.findFirst({ where: { id: systemId, organizationId, ...(demoOnly ? { systemCode: { startsWith: this.demoSystemPrefix } } : {}) } });
    if (!system) throw new NotFoundException('System not found.');
    const description = String(body.description ?? '').trim();
    if (!description) throw new BadRequestException('Describe the work performed.');
    const activityDate = this.validDate(body.date);
    const optional = (value: unknown, max: number) => { const text = String(value ?? '').trim(); return text ? text.slice(0, max) : null; };
    return this.prisma.rahcomActivity.create({ data: {
      organizationId, createdById: user.id, performedBy: `${user.firstName} ${user.lastName}`.trim() || user.username,
      systemId: system.id, systemNameSnapshot: system.systemName, systemCodeSnapshot: system.systemCode, provinceSnapshot: system.province,
      activityDate, activityType: 'SYSTEM_VISIT', quantity: 1, description: demoOnly ? `${this.demoActivityPrefix} ${description}`.slice(0, 1000) : description.slice(0, 1000),
      accompaniedBy: optional(body.accompaniedBy, 200), handedOverTo: optional(body.handedOverTo, 200),
    } });
  }
  async deleteActivity(user: AuthenticatedUser, id: string) {
    const { organizationId, demoOnly } = await this.authorize(user, true);
    const result = await this.prisma.rahcomActivity.deleteMany({ where: { id, organizationId, ...(demoOnly ? { description: { startsWith: this.demoActivityPrefix } } : {}) } });
    if (!result.count) throw new NotFoundException('Activity not found.');
    return { deleted: true };
  }
}
