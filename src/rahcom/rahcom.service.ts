import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../core/prisma/prisma.service';
import type { AuthenticatedUser } from '../core/auth/strategies/jwt.strategy';
import type {
  CreateRahcomActivityDto,
  CreateRahcomAxisDto,
  CreateRahcomSystemActivityDto,
  CreateRahcomSolarSnapshotDto,
  ReplaceRahcomSolarSpecialSystemsDto,
  CreateRahcomTrafficSnapshotDto,
  ImportRahcomTicketsDto,
  ImportRahcomSystemsDto,
  UpdateRahcomAxisDto,
  RahcomActivitiesQueryDto,
  UpdateRahcomSystemDto,
} from './dto/rahcom.dto';
import { canonicalRahcomAxisForProvince, defaultIsfahanAxes, isRahcomProvinceId, rahcomProvinceIdFromLabel } from './rahcom-axis';

type RahcomAccess = { organizationId: string; memberId: string | null; demoOnly: boolean; isAdmin: boolean; province: string | null; selectedProvince: string | null };

@Injectable()
export class RahcomService {
  private readonly demoSystemPrefix = 'DEMO-RAHCOM-';
  private readonly demoActivityPrefix = 'DEMO-RAHCOM |';
  constructor(private readonly prisma: PrismaService) {}
  private organization(user: AuthenticatedUser) {
    if (!user.organizationId) throw new BadRequestException('No active organization is selected.');
    return user.organizationId;
  }
  private async authorize(user: AuthenticatedUser, write: boolean | 'activity' = false): Promise<RahcomAccess> {
    const organizationId = this.organization(user);
    const membership = await this.prisma.organizationMember.findFirst({
      where: { organizationId, userId: user.id, status: 'ACTIVE', organization: { status: 'ACTIVE' } },
      select: {
        id: true,
        rahcomProvince: true,
        rahcomSelectedProvince: true,
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
      return { organizationId, memberId: null, demoOnly: false, isAdmin: true, province: null, selectedProvince: 'isfahan' };
    }
    const roles = membership.roles.map(({ role }) => role);
    const demoOnly = roles.some(({ key }) => key.toUpperCase() === 'DEMO_USER');
    const isOrganizationAdmin = roles.some(({ key }) => ['ADMIN', 'SUPER_ADMIN'].includes(key.toUpperCase()));
    const isAdmin = isOrganizationAdmin || membership.organization.ownerId === user.id;
    if (write && (demoOnly || (!isAdmin && write !== 'activity'))) throw new ForbiddenException('Only organization administrators can manage Rahcom data; assigned users can record maintenance activities.');
    const province = demoOnly ? 'isfahan' : membership.rahcomProvince;
    if (!isAdmin && !demoOnly && !province) throw new ForbiddenException('An administrator must assign your Rahcom province before access is granted.');
    return { organizationId, memberId: membership.id, demoOnly, isAdmin, province, selectedProvince: demoOnly ? 'isfahan' : membership.rahcomSelectedProvince ?? 'isfahan' };
  }
  private scopedProvince(access: RahcomAccess, requested?: string | null) {
    const province = String(requested ?? (access.isAdmin ? access.selectedProvince : '') ?? '').trim();
    if (access.demoOnly) {
      if (province && province !== 'isfahan') throw new ForbiddenException('Demo accounts can only access Isfahan Rahcom data.');
      return 'isfahan';
    }
    if (province && province !== 'all' && !isRahcomProvinceId(province)) throw new BadRequestException('Choose a supported province.');
    if (access.isAdmin) return !province || province === 'all' ? undefined : province;
    if (province && province !== access.province) throw new ForbiddenException('You can only access Rahcom data for your assigned province.');
    return access.province;
  }
  async getRahcomAccess(user: AuthenticatedUser) {
    const access = await this.authorize(user);
    return { memberId: access.memberId, province: access.province, selectedProvince: access.isAdmin ? access.selectedProvince : access.province, isAdmin: access.isAdmin, canManageAssignments: access.isAdmin && !access.demoOnly, canRecordActivities: !access.demoOnly && (access.isAdmin || Boolean(access.province)) };
  }
  async updateSelectedProvince(user: AuthenticatedUser, province: string) {
    const access = await this.authorize(user);
    if (!access.isAdmin || access.demoOnly || !access.memberId) throw new ForbiddenException('Only organization administrators can choose the Rahcom province view.');
    const normalized = String(province ?? '').trim();
    if (normalized !== 'all' && !isRahcomProvinceId(normalized)) throw new BadRequestException('Choose a supported province.');
    return this.prisma.organizationMember.update({ where: { id: access.memberId }, data: { rahcomSelectedProvince: normalized }, select: { rahcomSelectedProvince: true } });
  }
  private validDate(value: unknown) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('Date must use YYYY-MM-DD.');
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new BadRequestException('Invalid date.');
    return date;
  }
  async listSystems(user: AuthenticatedUser, province?: string) {
    const access = await this.authorize(user);
    const selectedProvince = this.scopedProvince(access, province);
    return this.prisma.rahcomSystem.findMany({ where: { organizationId: access.organizationId, ...(access.demoOnly ? { systemCode: { startsWith: this.demoSystemPrefix } } : {}), ...(selectedProvince ? { province: selectedProvince } : {}) }, orderBy: [{ province: 'asc' }, { systemName: 'asc' }] });
  }
  async listImportedTickets(user: AuthenticatedUser, requestedProvince?: string) {
    const access = await this.authorize(user);
    const province = this.scopedProvince(access, requestedProvince);
    const provinceSystems = province ? await this.prisma.rahcomSystem.findMany({
      where: { organizationId: access.organizationId, province, ...(access.demoOnly ? { systemCode: { startsWith: this.demoSystemPrefix } } : {}) },
      select: { systemCode: true },
    }) : [];
    const candidateCodes = [...new Set(provinceSystems.map(({ systemCode }) => systemCode))];
    const allMatchingSystems = candidateCodes.length ? await this.prisma.rahcomSystem.findMany({
      where: { organizationId: access.organizationId, systemCode: { in: candidateCodes } }, select: { systemCode: true, province: true },
    }) : [];
    const provincesByCode = new Map<string, Set<string>>();
    for (const system of allMatchingSystems) {
      const provinces = provincesByCode.get(system.systemCode) ?? new Set<string>();
      provinces.add(system.province);
      provincesByCode.set(system.systemCode, provinces);
    }
    const legacyCodes = candidateCodes.filter((code) => provincesByCode.get(code)?.size === 1);
    return this.prisma.rahcomImportedTicket.findMany({
      where: {
        organizationId: access.organizationId,
        ...(access.demoOnly ? { systemCode: { startsWith: this.demoSystemPrefix } } : {}),
        ...(province ? { OR: [
          { province },
          ...(legacyCodes.length ? [{ province: null, systemCode: { in: legacyCodes } }] : []),
        ] } : {}),
      },
      orderBy: [{ importedAt: 'desc' }, { ticketCode: 'asc' }],
    });
  }
  async importTickets(user: AuthenticatedUser, body: ImportRahcomTicketsDto) {
    const access = await this.authorize(user, true);
    const sourceFileName = body.sourceFileName.trim();
    const requestedCodes = [...new Set(body.tickets.map((row) => row.systemCode?.trim()).filter((code): code is string => Boolean(code)))];
    const systems = requestedCodes.length ? await this.prisma.rahcomSystem.findMany({
      where: { organizationId: access.organizationId, systemCode: { in: requestedCodes } }, select: { systemCode: true, province: true },
    }) : [];
    const provincesByCode = new Map<string, Set<string>>();
    for (const system of systems) {
      const provinces = provincesByCode.get(system.systemCode) ?? new Set<string>();
      provinces.add(system.province);
      provincesByCode.set(system.systemCode, provinces);
    }
    const systemProvinces = new Map([...provincesByCode].filter(([, provinces]) => provinces.size === 1).map(([code, provinces]) => [code, [...provinces][0]]));
    for (const row of body.tickets) {
      const requestedProvince = String(row.province ?? '').trim();
      if (requestedProvince && !isRahcomProvinceId(requestedProvince)) throw new BadRequestException('Choose a supported province for each imported ticket.');
      if ((!access.isAdmin || access.demoOnly) && requestedProvince && requestedProvince !== access.province) {
        throw new ForbiddenException('You can only import tickets for your assigned province.');
      }
      const systemCode = row.systemCode?.trim() ?? '';
      const knownProvinces = provincesByCode.get(systemCode);
      if (knownProvinces?.size && requestedProvince && !knownProvinces.has(requestedProvince)) {
        throw new BadRequestException(`Ticket ${row.ticketCode} province does not match its system.`);
      }
      if (knownProvinces && knownProvinces.size > 1 && !requestedProvince) {
        throw new BadRequestException(`Choose a province for ticket ${row.ticketCode}; its system code is used in multiple provinces.`);
      }
      if ((!access.isAdmin || access.demoOnly) && knownProvinces?.size && !knownProvinces.has(access.province ?? '')) {
        throw new ForbiddenException(`Ticket ${row.ticketCode} belongs to a different province.`);
      }
    }
    const rows = body.tickets.map((row) => ({
      organizationId: access.organizationId,
      ticketCode: row.ticketCode.trim(),
      systemCode: row.systemCode?.trim() ?? '',
      province: access.isAdmin && !access.demoOnly
        ? row.province?.trim() || systemProvinces.get(row.systemCode?.trim() ?? '') || null
        : access.province,
      summary: row.summary?.trim() ?? '',
      customer: row.customer?.trim() ?? '',
      equipment: row.equipment?.trim() ?? '',
      type: row.type?.trim() ?? '',
      status: row.status?.trim() ?? '',
      priority: row.priority?.trim() ?? '',
      supportTeam: row.supportTeam?.trim() ?? '',
      createdOn: row.createdOn?.trim() ?? '',
      sourceFileName,
      importedAt: new Date(),
    }));
    if (rows.some(({ province }) => province && !isRahcomProvinceId(province))) throw new BadRequestException('Choose a supported province for each imported ticket.');
    if (new Set(rows.map(({ ticketCode }) => ticketCode)).size !== rows.length) throw new BadRequestException('Ticket codes must be unique within an import.');
    await this.prisma.$transaction(rows.map((row) => this.prisma.rahcomImportedTicket.upsert({
        where: { organizationId_ticketCode: { organizationId: row.organizationId, ticketCode: row.ticketCode } },
        create: row,
        update: {
          systemCode: row.systemCode, province: row.province, summary: row.summary, customer: row.customer, equipment: row.equipment,
          type: row.type, status: row.status, priority: row.priority, supportTeam: row.supportTeam,
          createdOn: row.createdOn, sourceFileName: row.sourceFileName, importedAt: row.importedAt,
        },
    })));
    return { imported: rows.length };
  }
  async listProvinceAssignments(user: AuthenticatedUser) {
    const access = await this.authorize(user);
    if (!access.isAdmin || access.demoOnly) throw new ForbiddenException('Only organization administrators can manage Rahcom province assignments.');
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId: access.organizationId, status: 'ACTIVE' },
      select: { id: true, rahcomProvince: true, user: { select: { id: true, username: true, firstName: true, lastName: true } } },
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
    });
    return members.map(({ id, rahcomProvince, user: member }) => ({ id, userId: member.id, username: member.username, name: `${member.firstName} ${member.lastName}`.trim(), province: rahcomProvince }));
  }
  async updateProvinceAssignment(user: AuthenticatedUser, memberId: string, province: string | null) {
    const access = await this.authorize(user, true);
    if (!access.isAdmin || access.demoOnly) throw new ForbiddenException('Only organization administrators can manage Rahcom province assignments.');
    const normalized = String(province ?? '').trim() || null;
    if (normalized && !isRahcomProvinceId(normalized)) throw new BadRequestException('Choose a supported province.');
    const member = await this.prisma.organizationMember.findFirst({ where: { id: memberId, organizationId: access.organizationId, status: 'ACTIVE' }, select: { id: true } });
    if (!member) throw new NotFoundException('Active organization member not found.');
    return this.prisma.organizationMember.update({ where: { id: member.id }, data: { rahcomProvince: normalized }, select: { id: true, rahcomProvince: true } });
  }
  async listAxes(user: AuthenticatedUser, province?: string) {
    const access = await this.authorize(user);
    const { organizationId, demoOnly } = access;
    const selectedProvince = this.scopedProvince(access, province) ?? '';
    if (!selectedProvince || selectedProvince.length > 80) throw new BadRequestException('Select a province to list its axes.');
    const [systems, savedAxes] = await Promise.all([
      this.prisma.rahcomSystem.findMany({
        where: { organizationId, province: selectedProvince, ...(demoOnly ? { systemCode: { startsWith: this.demoSystemPrefix } } : {}) },
        select: { axis: true },
      }),
      this.prisma.rahcomAxis.findMany({ where: { organizationId, province: selectedProvince }, select: { id: true } }),
    ]);
    const normalizeLegacy = savedAxes.length === 0;
    const normalizedByLegacy = new Map<string, string>();
    for (const system of systems) {
      const legacyName = String(system.axis ?? '').trim();
      if (legacyName) normalizedByLegacy.set(legacyName, normalizeLegacy ? canonicalRahcomAxisForProvince(selectedProvince, legacyName) : legacyName);
    }
    const names = [...new Set([
      ...(normalizeLegacy && selectedProvince === 'isfahan' ? defaultIsfahanAxes : []),
      ...normalizedByLegacy.values(),
    ])].filter(Boolean);
    if (demoOnly) return names.map((name) => ({ id: `demo:${name}`, organizationId, province: selectedProvince, name }));

    if (names.length) {
      await this.prisma.rahcomAxis.createMany({ data: names.map((name) => ({ organizationId, province: selectedProvince, name })), skipDuplicates: true });
      if (normalizeLegacy) for (const [legacyName, name] of normalizedByLegacy) {
        if (legacyName !== name) await this.prisma.rahcomSystem.updateMany({ where: { organizationId, province: selectedProvince, axis: legacyName }, data: { axis: name } });
      }
    }
    return this.prisma.rahcomAxis.findMany({ where: { organizationId, province: selectedProvince }, orderBy: { name: 'asc' } });
  }
  async createAxis(user: AuthenticatedUser, body: CreateRahcomAxisDto) {
    const access = await this.authorize(user, true);
    const organizationId = access.organizationId;
    const province = this.scopedProvince(access, String(body.province ?? '').trim()) ?? '';
    const name = String(body.name ?? '').trim();
    if (!province || province.length > 80 || !name || name.length > 120) throw new BadRequestException('Provide a province and an axis name.');
    const duplicate = await this.prisma.rahcomAxis.findFirst({ where: { organizationId, province, name } });
    if (duplicate) throw new BadRequestException('An axis with this name already exists in the province.');
    return this.prisma.rahcomAxis.create({ data: { organizationId, province, name } });
  }
  async updateAxis(user: AuthenticatedUser, id: string, requestedName: UpdateRahcomAxisDto['name']) {
    const access = await this.authorize(user, true);
    const { organizationId } = access;
    const name = String(requestedName ?? '').trim();
    if (!name || name.length > 120) throw new BadRequestException('Provide a valid axis name.');
    const existing = await this.prisma.rahcomAxis.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException('Axis not found.');
    this.scopedProvince(access, existing.province);
    if (existing.name === name) return existing;
    const duplicate = await this.prisma.rahcomAxis.findFirst({ where: { organizationId, province: existing.province, name } });
    if (duplicate) throw new BadRequestException('An axis with this name already exists in the province.');
    return this.prisma.$transaction(async (tx) => {
      await tx.rahcomSystem.updateMany({ where: { organizationId, province: existing.province, axis: existing.name }, data: { axis: name } });
      return tx.rahcomAxis.update({ where: { id }, data: { name } });
    });
  }
  async deleteAxis(user: AuthenticatedUser, id: string) {
    const access = await this.authorize(user, true);
    const { organizationId } = access;
    const existing = await this.prisma.rahcomAxis.findFirst({ where: { id, organizationId } });
    if (!existing) throw new NotFoundException('Axis not found.');
    this.scopedProvince(access, existing.province);
    await this.prisma.$transaction(async (tx) => {
      await tx.rahcomSystem.updateMany({ where: { organizationId, province: existing.province, axis: existing.name }, data: { axis: null } });
      await tx.rahcomAxis.delete({ where: { id } });
    });
    return { deleted: true };
  }
  async mergeAxis(user: AuthenticatedUser, sourceId: string, targetId: string) {
    const access = await this.authorize(user, true);
    const { organizationId } = access;
    if (sourceId === targetId) throw new BadRequestException('Choose a different target axis.');
    const [source, target] = await Promise.all([
      this.prisma.rahcomAxis.findFirst({ where: { id: sourceId, organizationId } }),
      this.prisma.rahcomAxis.findFirst({ where: { id: targetId, organizationId } }),
    ]);
    if (!source || !target) throw new NotFoundException('Axis not found.');
    this.scopedProvince(access, source.province);
    if (source.province !== target.province) throw new BadRequestException('Axes can only be merged within the same province.');
    await this.prisma.$transaction(async (tx) => {
      await tx.rahcomSystem.updateMany({ where: { organizationId, province: source.province, axis: source.name }, data: { axis: target.name } });
      await tx.rahcomAxis.delete({ where: { id: source.id } });
    });
    return { merged: true, targetAxis: target };
  }
  async listSolarSnapshots(user: AuthenticatedUser, requestedProvince?: string) {
    const access = await this.authorize(user);
    const province = this.scopedProvince(access, requestedProvince);
    return this.prisma.rahcomSolarSnapshot.findMany({ where: { organizationId: access.organizationId, ...(province ? { province } : {}), ...(access.demoOnly ? { createdById: user.id } : {}) }, orderBy: { capturedAt: 'desc' }, take: 100 });
  }
  async createSolarSnapshot(user: AuthenticatedUser, body: CreateRahcomSolarSnapshotDto) {
    const access = await this.authorize(user, true);
    const province = this.scopedProvince(access, body.province);
    if (!province || !isRahcomProvinceId(province)) throw new BadRequestException('Choose one supported province before saving a solar status snapshot.');
    const text = `${body.downText}\n${body.unreachableText}`;
    const codes = [...new Set((text.match(/\d{3}[A-Z]\d{5}/gi) ?? []).map((code) => code.toUpperCase()))];
    const systems = codes.length ? await this.prisma.rahcomSystem.findMany({
      where: { organizationId: access.organizationId, systemCode: { in: codes, mode: 'insensitive' } },
      select: { systemCode: true, province: true },
    }) : [];
    const knownCodes = new Set(systems.map((system) => system.systemCode.toUpperCase()));
    const provinceCodes = new Set(systems.filter((system) => system.province === province).map((system) => system.systemCode.toUpperCase()));
    if (codes.some((code) => knownCodes.has(code) && !provinceCodes.has(code)) || (province !== 'isfahan' && /Rahcom\s*\([^)]*(?:-ESF(?:-|\))|ISFAHAN)/i.test(text))) {
      throw new BadRequestException('The solar report contains systems from another province. Split the report by province before saving.');
    }
    const capturedAt = body.capturedAt ? new Date(body.capturedAt) : new Date();
    if (Number.isNaN(capturedAt.getTime())) throw new BadRequestException('Invalid snapshot date and time.');
    return this.prisma.rahcomSolarSnapshot.create({ data: {
      organizationId: access.organizationId, createdById: user.id, province, capturedAt,
      downText: body.downText, unreachableText: body.unreachableText,
      equipmentColumns: [...new Set(body.equipmentColumns.map((item) => item.trim()).filter(Boolean))],
    } });
  }
  async updateSolarSnapshot(user: AuthenticatedUser, id: string, body: CreateRahcomSolarSnapshotDto) {
    const access = await this.authorize(user, true);
    const existing = await this.prisma.rahcomSolarSnapshot.findFirst({ where: { id, organizationId: access.organizationId } });
    if (!existing) throw new NotFoundException('Solar status was not found.');
    this.scopedProvince(access, existing.province);
    const province = this.scopedProvince(access, body.province);
    if (province !== existing.province) throw new BadRequestException('A saved solar status cannot be moved to another province.');
    const capturedAt = body.capturedAt ? new Date(body.capturedAt) : existing.capturedAt;
    if (Number.isNaN(capturedAt.getTime())) throw new BadRequestException('Invalid snapshot date and time.');
    const text = `${body.downText}\n${body.unreachableText}`;
    const codes = [...new Set((text.match(/\d{3}[A-Z]\d{5}/gi) ?? []).map((code) => code.toUpperCase()))];
    if (codes.length) {
      const systems = await this.prisma.rahcomSystem.findMany({ where: { organizationId: access.organizationId, systemCode: { in: codes, mode: 'insensitive' } }, select: { systemCode: true, province: true } });
      const knownCodes = new Set(systems.map((system) => system.systemCode.toUpperCase()));
      const provinceCodes = new Set(systems.filter((system) => system.province === existing.province).map((system) => system.systemCode.toUpperCase()));
      if (codes.some((code) => knownCodes.has(code) && !provinceCodes.has(code)) || (existing.province !== 'isfahan' && /Rahcom\s*\([^)]*(?:-ESF(?:-|\))|ISFAHAN)/i.test(text))) {
        throw new BadRequestException('The solar report contains systems from another province. Split the report by province before saving.');
      }
    }
    return this.prisma.rahcomSolarSnapshot.update({ where: { id: existing.id }, data: {
      capturedAt, downText: body.downText, unreachableText: body.unreachableText,
      equipmentColumns: [...new Set(body.equipmentColumns.map((item) => item.trim()).filter(Boolean))],
    } });
  }
  async deleteSolarSnapshot(user: AuthenticatedUser, id: string) {
    const access = await this.authorize(user, true);
    const existing = await this.prisma.rahcomSolarSnapshot.findFirst({ where: { id, organizationId: access.organizationId } });
    if (!existing) throw new NotFoundException('Solar status was not found.');
    this.scopedProvince(access, existing.province);
    await this.prisma.rahcomSolarSnapshot.delete({ where: { id: existing.id } });
    return { deleted: true };
  }
  async listSolarSpecialSystems(user: AuthenticatedUser, requestedProvince?: string) {
    const access = await this.authorize(user);
    const province = this.scopedProvince(access, requestedProvince);
    const demoCodes = access.demoOnly
      ? (await this.prisma.rahcomSystem.findMany({ where: { organizationId: access.organizationId, province: 'isfahan', systemCode: { startsWith: this.demoSystemPrefix } }, select: { systemCode: true } })).map(({ systemCode }) => systemCode)
      : null;
    return this.prisma.rahcomSolarSpecialSystem.findMany({
      where: { organizationId: access.organizationId, ...(province ? { province } : {}), ...(demoCodes ? { systemCode: { in: demoCodes } } : {}) },
      orderBy: [{ province: 'asc' }, { systemCode: 'asc' }],
    });
  }
  async replaceSolarSpecialSystems(user: AuthenticatedUser, body: ReplaceRahcomSolarSpecialSystemsDto) {
    const access = await this.authorize(user, true);
    const province = this.scopedProvince(access, body.province);
    if (!province || !isRahcomProvinceId(province)) throw new BadRequestException('Choose a supported province for the special system list.');
    const systems = [...new Map(body.systems.map((item) => [item.systemCode.trim().toUpperCase(), item.category])).entries()];
    const codes = systems.map(([systemCode]) => systemCode);
    if (codes.length) {
      const knownSystems = await this.prisma.rahcomSystem.findMany({
        where: { organizationId: access.organizationId, systemCode: { in: codes, mode: 'insensitive' } },
        select: { systemCode: true, province: true },
      });
      const knownCodes = new Set(knownSystems.map(({ systemCode }) => systemCode.toUpperCase()));
      const provinceCodes = new Set(knownSystems.filter((system) => system.province === province).map(({ systemCode }) => systemCode.toUpperCase()));
      if (codes.some((code) => knownCodes.has(code) && !provinceCodes.has(code))) {
        throw new BadRequestException('The special system list contains a code assigned to another province.');
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.rahcomSolarSpecialSystem.deleteMany({ where: { organizationId: access.organizationId, province } });
      if (systems.length) await tx.rahcomSolarSpecialSystem.createMany({
        data: systems.map(([systemCode, category]) => ({ organizationId: access.organizationId, province, systemCode, category })),
      });
    });
    return this.prisma.rahcomSolarSpecialSystem.findMany({ where: { organizationId: access.organizationId, province }, orderBy: { systemCode: 'asc' } });
  }
  async listTrafficSnapshot(user: AuthenticatedUser, requestedProvince?: string) {
    const access = await this.authorize(user);
    const { organizationId, demoOnly } = access;
    const snapshot = await this.prisma.rahcomTrafficSnapshot.findFirst({ where: { organizationId, ...(demoOnly ? { createdById: user.id } : {}) }, orderBy: { createdAt: 'desc' } });
    const province = this.scopedProvince(access, requestedProvince);
    if (!snapshot || !province) return snapshot;
    const headers = Array.isArray(snapshot.headers) ? snapshot.headers.map(String) : [];
    const normalizeHeader = (value: string) => value.replace(/[\s\u200c_./-]/g, '').toLocaleLowerCase();
    const normalizedHeaders = headers.map(normalizeHeader);
    const provinceIndex = normalizedHeaders.findIndex((header) => header.includes('province') || header.includes('\u0627\u0633\u062a\u0627\u0646'));
    const codeIndex = normalizedHeaders.findIndex((header) => header.includes('systemcode') || header.includes('\u06a9\u062f\u0633\u0627\u0645\u0627\u0646\u0647'));
    const systems = codeIndex >= 0 ? await this.prisma.rahcomSystem.findMany({
      where: { organizationId, province, ...(demoOnly ? { systemCode: { startsWith: this.demoSystemPrefix } } : {}) }, select: { systemCode: true },
    }) : [];
    const candidateCodes = [...new Set(systems.map(({ systemCode }) => systemCode.trim().toLocaleUpperCase()))];
    const allSystems = candidateCodes.length ? await this.prisma.rahcomSystem.findMany({
      where: { organizationId, systemCode: { in: candidateCodes } }, select: { systemCode: true, province: true },
    }) : [];
    const provincesByCode = new Map<string, Set<string>>();
    for (const system of allSystems) {
      const code = system.systemCode.trim().toLocaleUpperCase();
      const provinces = provincesByCode.get(code) ?? new Set<string>();
      provinces.add(system.province);
      provincesByCode.set(code, provinces);
    }
    const allowedCodes = new Set(candidateCodes.filter((code) => provincesByCode.get(code)?.size === 1));
    const rows = Array.isArray(snapshot.rows) ? (snapshot.rows as unknown[]).filter((candidate) => {
      if (!Array.isArray(candidate)) return false;
      const row = candidate.map((cell) => String(cell ?? ''));
      const rawProvince = provinceIndex >= 0 ? (row[provinceIndex] ?? '').trim() : '';
      if (rawProvince) return rahcomProvinceIdFromLabel(rawProvince) === province;
      return codeIndex >= 0 && allowedCodes.has((row[codeIndex] ?? '').trim().toLocaleUpperCase());
    }) : [];
    return { ...snapshot, rows, rowCount: rows.length };
  }

  async listTrafficSystemHistory(user: AuthenticatedUser, requestedCode: string) {
    const access = await this.authorize(user);
    const { organizationId, demoOnly } = access;
    const systemCode = String(requestedCode ?? '').trim().toUpperCase();
    if (!systemCode || systemCode.length > 100) throw new BadRequestException('Provide a valid system code.');
    const province = this.scopedProvince(access);
    let codeBelongsOnlyToRequestedProvince = false;
    if (province) {
      const systems = await this.prisma.rahcomSystem.findMany({ where: { organizationId, systemCode, province, ...(demoOnly ? { systemCode: { startsWith: this.demoSystemPrefix, equals: systemCode } } : {}) }, select: { id: true } });
      if (!systems.length) throw new NotFoundException('System not found in the selected province.');
      const allMatchingSystems = await this.prisma.rahcomSystem.findMany({
        where: { organizationId, systemCode, ...(demoOnly ? { systemCode: { startsWith: this.demoSystemPrefix, equals: systemCode } } : {}) },
        select: { province: true },
      });
      codeBelongsOnlyToRequestedProvince = new Set(allMatchingSystems.map(({ province: itemProvince }) => itemProvince)).size === 1;
    }
    const snapshots = await this.prisma.rahcomTrafficSnapshot.findMany({
      where: { organizationId, ...(demoOnly ? { createdById: user.id } : {}) },
      orderBy: { createdAt: 'desc' }, take: 100,
      select: { id: true, fileName: true, sheetName: true, headers: true, rows: true, rowCount: true, createdAt: true },
    });
    return snapshots.flatMap((snapshot) => {
      const headers = Array.isArray(snapshot.headers) ? snapshot.headers.map(String) : [];
      const codeIndex = headers.findIndex((header) => header.replace(/[\s\u200c]/g, '').toLocaleLowerCase().includes('کدسامانه') || header.toLocaleLowerCase().includes('systemcode'));
      if (codeIndex < 0 || !Array.isArray(snapshot.rows)) return [];
      const provinceIndex = headers.findIndex((header) => header.replace(/[\s\u200c_./-]/g, '').toLocaleLowerCase().includes('province') || header.includes('\u0627\u0633\u062a\u0627\u0646'));
      const rows = (snapshot.rows as unknown[]).filter((candidate): candidate is unknown[] => {
        if (!Array.isArray(candidate) || String(candidate[codeIndex] ?? '').trim().toUpperCase() !== systemCode) return false;
        if (!province) return true;
        if (provinceIndex < 0) return codeBelongsOnlyToRequestedProvince;
        const rawProvince = String(candidate[provinceIndex] ?? '').trim();
        if (!rawProvince) return codeBelongsOnlyToRequestedProvince;
        return rawProvince === province || rahcomProvinceIdFromLabel(rawProvince) === province;
      });
      return rows.map((row) => ({ id: snapshot.id, fileName: snapshot.fileName, sheetName: snapshot.sheetName, rowCount: snapshot.rowCount, createdAt: snapshot.createdAt, headers, row: row.map((cell) => String(cell ?? '')) }));
    });
  }
  async createTrafficSnapshot(user: AuthenticatedUser, body: CreateRahcomTrafficSnapshotDto) {
    const { organizationId, isAdmin } = await this.authorize(user, true);
    if (!isAdmin) throw new ForbiddenException('Only organization administrators can upload the national traffic list.');
    const fileName = String(body.fileName ?? '').trim().slice(0, 255);
    const sheetName = String(body.sheetName ?? '').trim().slice(0, 120);
    const headers = Array.isArray(body.headers) ? body.headers.map((value) => String(value ?? '').trim().slice(0, 120)) : [];
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!fileName || !sheetName || headers.length < 2 || headers.length > 50 || rows.length > 10000) throw new BadRequestException('Provide a valid Excel traffic list.');
    if (rows.some((row) => !Array.isArray(row) || row.length !== headers.length || row.some((value) => typeof value !== 'string' || value.length > 2000))) {
      throw new BadRequestException('Traffic rows must match the Excel header columns.');
    }
    const serialized = JSON.stringify({ headers, rows });
    if (Buffer.byteLength(serialized, 'utf8') > 8 * 1024 * 1024) throw new BadRequestException('The parsed traffic list is too large to save.');
    if (!headers.some((value) => value.includes('کد سامانه')) || !headers.some((value) => value.includes('استان'))) {
      throw new BadRequestException('The selected worksheet must include system code and province columns.');
    }
    return this.prisma.rahcomTrafficSnapshot.create({
      data: { organizationId, createdById: user.id, fileName, sheetName, headers, rows, rowCount: rows.length },
    });
  }
  async applyTrafficAxes(user: AuthenticatedUser) {
    const { organizationId, demoOnly, isAdmin } = await this.authorize(user, true);
    if (!isAdmin) throw new ForbiddenException('Only organization administrators can apply the national traffic list.');
    const snapshot = await this.prisma.rahcomTrafficSnapshot.findFirst({
      where: { organizationId, ...(demoOnly ? { createdById: user.id } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    if (!snapshot) throw new NotFoundException('No traffic list has been registered yet.');

    const normalizeHeader = (value: string) => value.trim().toLocaleLowerCase('fa').replace(/[\u200c\s]/g, '');
    const headers = Array.isArray(snapshot.headers) ? snapshot.headers.map((value) => String(value ?? '')) : [];
    const rows = Array.isArray(snapshot.rows) ? snapshot.rows as unknown[][] : [];
    const normalizedHeaders = headers.map(normalizeHeader);
    const codeIndex = normalizedHeaders.findIndex((value) => value.includes('کدسامانه'));
    const provinceIndex = normalizedHeaders.findIndex((value) => value.includes('استان'));
    const axisCodeIndex = normalizedHeaders.findIndex((value) => value.includes('کدمحور'));
    const axisNameIndex = normalizedHeaders.findIndex((value) => value.includes('ناممحور'));
    if ([codeIndex, provinceIndex, axisCodeIndex].some((index) => index < 0)) {
      throw new BadRequestException('The registered traffic list must include system code, province and axis code columns.');
    }

    const labelCounts = new Map<string, Map<string, number>>();
    const rowKeys: Array<{ key: string; systemCode: string }> = [];
    const listedSystems = new Set<string>();
    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      const province = rahcomProvinceIdFromLabel(String(row[provinceIndex] ?? ''));
      const systemCode = String(row[codeIndex] ?? '').trim();
      const axisCode = String(row[axisCodeIndex] ?? '').trim();
      const axisLabel = axisNameIndex >= 0 ? String(row[axisNameIndex] ?? '').trim() : '';
      if (!province || !systemCode) continue;
      listedSystems.add(`${province}\u0000${systemCode}`);
      if (!axisCode) continue;
      const key = `${province}\u0000${axisCode}`;
      const labels = labelCounts.get(key) ?? new Map<string, number>();
      if (axisLabel) labels.set(axisLabel, (labels.get(axisLabel) ?? 0) + 1);
      labelCounts.set(key, labels);
      rowKeys.push({ key, systemCode });
    }
    if (!rowKeys.length) throw new BadRequestException('No rows with a valid province, system code and axis code were found.');

    const axisNamesByKey = new Map<string, { province: string; axisCode: string; name: string }>();
    for (const key of labelCounts.keys()) {
      const separator = key.indexOf('\u0000');
      const province = key.slice(0, separator);
      const axisCode = key.slice(separator + 1);
      const labels = [...(labelCounts.get(key) ?? new Map()).entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
      const sourceName = labels[0]?.[0] ?? `محور ${axisCode}`;
      const normalizedName = canonicalRahcomAxisForProvince(province, sourceName) || sourceName;
      axisNamesByKey.set(key, { province, axisCode, name: normalizedName });
    }

    const assignments = new Map<string, { province: string; axisCode: string; name: string; codes: Set<string> }>();
    for (const { key, systemCode } of rowKeys) {
      const axis = axisNamesByKey.get(key);
      if (!axis) continue;
      const assignmentKey = key;
      const assignment = assignments.get(assignmentKey) ?? { ...axis, codes: new Set<string>() };
      assignment.codes.add(systemCode);
      assignments.set(assignmentKey, assignment);
    }

    const axisRows = [...new Map([...assignments.values()].map(({ province, name }) => [`${province}\u0000${name}`, { organizationId, province, name }])).values()];
    const mutations = [
      ...(axisRows.length ? [this.prisma.rahcomAxis.createMany({ data: axisRows, skipDuplicates: true })] : []),
      ...[...assignments.values()].map(({ province, name, axisCode, codes }) => this.prisma.rahcomSystem.updateMany({
        where: { organizationId, province, ...(demoOnly ? { systemCode: { startsWith: this.demoSystemPrefix, in: [...codes] } } : { systemCode: { in: [...codes] } }) },
        data: { axis: name, axisCode },
      })),
    ];
    const results = await this.prisma.$transaction(mutations, { maxWait: 10_000, timeout: 30_000 });
    const updatedSystems = results.slice(axisRows.length ? 1 : 0).reduce((total, result) => total + ('count' in result ? result.count : 0), 0);
    return { updatedSystems, unmatchedSystems: Math.max(0, listedSystems.size - updatedSystems), axisGroups: assignments.size };
  }
  async importSystems(user: AuthenticatedUser, body: ImportRahcomSystemsDto) {
    const access = await this.authorize(user, true);
    const { organizationId, demoOnly } = access;
    const province = this.scopedProvince(access, String(body?.province ?? '').trim()) ?? '';
    if (!province || province.length > 80 || !Array.isArray(body?.systems) || body.systems.length > 10000) throw new BadRequestException('Select a province and provide at most 10,000 rows.');
    const configuredAxes = new Set((await this.prisma.rahcomAxis.findMany({ where: { organizationId, province }, select: { name: true } })).map(({ name }) => name));
    const rows = body.systems.map((raw, index): {
      organizationId: string; province: string; systemName: string; systemCode: string; latitude: number; longitude: number; axis?: string | null; axisCode?: string | null;
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
        ...(row.axis !== undefined ? { axis: this.optionalText(configuredAxes.has(String(row.axis ?? '').trim()) ? row.axis : canonicalRahcomAxisForProvince(province, row.axis), 120) } : {}),
        ...(row.axisCode !== undefined ? { axisCode: this.optionalText(row.axisCode, 100) } : {}),
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
    const axisNames = [...new Set(rows.map(({ axis }) => axis).filter((axis): axis is string => Boolean(axis)))];
    if (axisNames.length) {
      const existingAxes = await this.prisma.rahcomAxis.count({ where: { organizationId, province } });
      const initialIsfahanAxes = existingAxes === 0 && province === 'isfahan' ? defaultIsfahanAxes : [];
      await this.prisma.rahcomAxis.createMany({ data: [...new Set([...initialIsfahanAxes, ...axisNames])].map((name) => ({ organizationId, province, name })), skipDuplicates: true });
    }
    await this.prisma.$transaction(rows.map((row) => {
      const { details, axis, axisCode, electricityBillId, simIp, radarIp, cameraIp, pcIp, routerIp, laptopIp, incidentType, incidentDetails, ...required } = row;
      const optionalData = { details, axis, axisCode, electricityBillId, simIp, radarIp, cameraIp, pcIp, routerIp, laptopIp, incidentType, incidentDetails };
      return this.prisma.rahcomSystem.upsert({
        where: { organizationId_province_systemCode: { organizationId, province, systemCode: row.systemCode } },
        update: { ...required, ...Object.fromEntries(Object.entries(optionalData).filter(([, value]) => value !== undefined)) },
        create: { ...required, details: details ?? null, axis: axis ?? null, axisCode: axisCode ?? null, electricityBillId: electricityBillId ?? null, simIp: simIp ?? null, radarIp: radarIp ?? null, cameraIp: cameraIp ?? null, pcIp: pcIp ?? null, routerIp: routerIp ?? null, laptopIp: laptopIp ?? null, incidentType: incidentType ?? null, incidentDetails: incidentDetails ?? null },
      });
    }));
    return { imported: rows.length };
  }
  async updateSystem(user: AuthenticatedUser, id: string, body: UpdateRahcomSystemDto) {
    const access = await this.authorize(user, true);
    const { organizationId, demoOnly } = access;
    if (Object.keys(body).length === 0) throw new BadRequestException('Provide at least one system field to update.');
    const existing = await this.prisma.rahcomSystem.findFirst({ where: { id, organizationId, ...(demoOnly ? { systemCode: { startsWith: this.demoSystemPrefix } } : {}) } });
    if (!existing) throw new NotFoundException('System not found.');
    this.scopedProvince(access, existing.province);
    const systemName = body.systemName === undefined ? existing.systemName : String(body.systemName ?? '').trim();
    const systemCode = body.systemCode === undefined ? existing.systemCode : String(body.systemCode ?? '').trim();
    const latitude = body.latitude === undefined ? existing.latitude : Number(body.latitude);
    const longitude = body.longitude === undefined ? existing.longitude : Number(body.longitude);
    if (!systemName || !systemCode || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new BadRequestException('Invalid system fields.');
    if (demoOnly && !systemCode.startsWith(this.demoSystemPrefix)) throw new ForbiddenException('Demo accounts cannot move systems outside the demo dataset.');
    const requestedAxis = body.axis === undefined ? undefined : this.optionalText(body.axis, 120);
    const configuredAxis = requestedAxis ? await this.prisma.rahcomAxis.findFirst({ where: { organizationId, province: existing.province, name: requestedAxis }, select: { name: true } }) : null;
    const axis = body.axis === undefined ? undefined : configuredAxis?.name ?? this.optionalText(canonicalRahcomAxisForProvince(existing.province, body.axis), 120);
    const optionalData = {
      ...(body.details !== undefined ? { details: this.optionalText(body.details, 1000) } : {}),
      ...(body.axis !== undefined ? { axis } : {}),
      ...(body.axisCode !== undefined ? { axisCode: this.optionalText(body.axisCode, 100) } : {}),
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
    if (axis) await this.prisma.rahcomAxis.createMany({ data: [{ organizationId, province: existing.province, name: axis }], skipDuplicates: true });
    return this.prisma.rahcomSystem.update({ where: { id }, data: { systemName, systemCode, latitude, longitude, ...optionalData } });
  }
  private optionalText(value: unknown, maxLength: number): string | null {
    const text = String(value ?? '').trim();
    return text ? text.slice(0, maxLength) : null;
  }
  async deleteSystem(user: AuthenticatedUser, id: string) {
    const access = await this.authorize(user, true);
    const { organizationId, demoOnly } = access;
    const existing = await this.prisma.rahcomSystem.findFirst({ where: { id, organizationId, ...(demoOnly ? { systemCode: { startsWith: this.demoSystemPrefix } } : {}) }, select: { province: true } });
    if (!existing) throw new NotFoundException('System not found.');
    this.scopedProvince(access, existing.province);
    const result = await this.prisma.rahcomSystem.deleteMany({ where: { id, organizationId, province: existing.province, ...(demoOnly ? { systemCode: { startsWith: this.demoSystemPrefix } } : {}) } });
    if (!result.count) throw new NotFoundException('System not found.');
    return { deleted: true };
  }
  async deleteSystems(user: AuthenticatedUser, input: { province?: string; ids?: string[] }) {
    const access = await this.authorize(user, true);
    const { organizationId, demoOnly } = access;
    const province = this.scopedProvince(access, String(input.province ?? '').trim()) ?? '';
    const ids = Array.isArray(input.ids) ? [...new Set(input.ids.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))] : [];
    if ((!province && !ids.length) || ids.length > 10000) throw new BadRequestException('Select a province or provide up to 10,000 system IDs.');
    const result = await this.prisma.rahcomSystem.deleteMany({ where: { organizationId, ...(demoOnly ? { systemCode: { startsWith: this.demoSystemPrefix } } : {}), ...(province ? { province, ...(ids.length ? { id: { in: ids } } : {}) } : { id: { in: ids } }) } });
    return { deleted: result.count };
  }
  async listActivities(user: AuthenticatedUser, query: RahcomActivitiesQueryDto) {
    const access = await this.authorize(user);
    const { organizationId, demoOnly } = access;
    const province = this.scopedProvince(access, query.province);
    if (!query.date && !query.from && !query.to) throw new BadRequestException('Provide a date or a date range.');
    if (query.date && (query.from || query.to)) throw new BadRequestException('Use either a single date or a date range.');
    const activityDate = query.date ? this.validDate(query.date) : undefined;
    const from = query.from ? this.validDate(query.from) : undefined;
    const to = query.to ? this.validDate(query.to) : undefined;
    if (Boolean(from) !== Boolean(to)) throw new BadRequestException('Both from and to dates are required for a range.');
    if (from && to && from > to) throw new BadRequestException('The start date must be before the end date.');
    const range = from && to ? { gte: from, lt: new Date(to.getTime() + 86_400_000) } : undefined;
    return this.prisma.rahcomActivity.findMany({ where: { organizationId, ...(range ? { activityDate: range } : activityDate ? { activityDate } : {}), ...(demoOnly ? { description: { startsWith: this.demoActivityPrefix } } : {}), ...(province ? { OR: [{ system: { province } }, { systemId: null, provinceSnapshot: province }] } : {}) }, include: { system: { select: { id: true, systemName: true, systemCode: true, province: true } } }, orderBy: [{ activityDate: 'desc' }, { createdAt: 'desc' }] });
  }
  createActivity(user: AuthenticatedUser, body: CreateRahcomActivityDto) {
    return this.createAuthorizedActivity(user, body);
  }
  private async createAuthorizedActivity(user: AuthenticatedUser, body: CreateRahcomActivityDto) {
    const access = await this.authorize(user, 'activity');
    const { organizationId, demoOnly } = access;
    const province = this.scopedProvince(access, body.province);
    const activityType = String(body.activityType ?? '').trim();
    const quantity = Number(body.quantity);
    const allowed = ['EMAIL_SENT', 'SYSTEM_VISIT', 'OTHER'];
    if (!allowed.includes(activityType) || !Number.isInteger(quantity) || quantity < 1 || quantity > 100000) throw new BadRequestException('Invalid activity type or quantity.');
    const systemId = body.systemId ? String(body.systemId).trim() : null;
    if (systemId) return this.createVisitRecord(user, access, systemId, body, province);
    if (!province) throw new BadRequestException('Select one province before recording an activity.');
    const description = body.description ? String(body.description).slice(0, 1000) : null;
    return this.prisma.rahcomActivity.create({ data: { organizationId, createdById: user.id, performedBy: `${user.firstName} ${user.lastName}`.trim() || user.username, activityDate: this.validDate(body.date), activityType, quantity, provinceSnapshot: province, description: demoOnly && description ? `${this.demoActivityPrefix} ${description}` : description } });
  }
  async listSystemActivities(user: AuthenticatedUser, systemId: string) {
    const access = await this.authorize(user);
    const { organizationId, demoOnly } = access;
    const system = await this.prisma.rahcomSystem.findFirst({ where: { id: systemId, organizationId, ...(demoOnly ? { systemCode: { startsWith: this.demoSystemPrefix } } : {}) }, select: { id: true, province: true } });
    if (!system) throw new NotFoundException('System not found.');
    this.scopedProvince(access, system.province);
    return this.prisma.rahcomActivity.findMany({ where: { organizationId, systemId, ...(demoOnly ? { description: { startsWith: this.demoActivityPrefix } } : {}) }, orderBy: [{ activityDate: 'desc' }, { createdAt: 'desc' }] });
  }
  async createSystemActivity(user: AuthenticatedUser, systemId: string, body: CreateRahcomSystemActivityDto) {
    const access = await this.authorize(user, 'activity');
    return this.createVisitRecord(user, access, systemId, body);
  }
  private async createVisitRecord(user: AuthenticatedUser, access: RahcomAccess, systemId: string, body: CreateRahcomActivityDto | CreateRahcomSystemActivityDto, requestedProvince?: string | null) {
    const { organizationId, demoOnly } = access;
    const system = await this.prisma.rahcomSystem.findFirst({ where: { id: systemId, organizationId, ...(demoOnly ? { systemCode: { startsWith: this.demoSystemPrefix } } : {}) } });
    if (!system) throw new NotFoundException('System not found.');
    this.scopedProvince(access, system.province);
    if (requestedProvince && requestedProvince !== system.province) throw new BadRequestException('The selected activity province must match the system province.');
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
    const access = await this.authorize(user, 'activity');
    const { organizationId, demoOnly } = access;
    const activity = await this.prisma.rahcomActivity.findFirst({ where: { id, organizationId, ...(demoOnly ? { description: { startsWith: this.demoActivityPrefix } } : {}) }, select: { systemId: true, createdById: true, provinceSnapshot: true, system: { select: { province: true } } } });
    if (!activity) throw new NotFoundException('Activity not found.');
    if (!access.isAdmin) {
      if (activity.createdById !== user.id) throw new ForbiddenException('You can only manage your own province activity records.');
      const province = activity.system?.province ?? activity.provinceSnapshot;
      if (!province) throw new ForbiddenException('This activity has no assigned province.');
      this.scopedProvince(access, province);
    }
    const result = await this.prisma.rahcomActivity.deleteMany({ where: { id, organizationId, ...(demoOnly ? { description: { startsWith: this.demoActivityPrefix } } : {}) } });
    if (!result.count) throw new NotFoundException('Activity not found.');
    return { deleted: true };
  }
}
