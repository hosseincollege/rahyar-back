import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../core/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import type { AuthenticatedUser } from '../core/auth/strategies/jwt.strategy';
import {
  CreateRahcomActivityDto,
  CreateRahcomAxisDto,
  CreateRahcomSystemActivityDto,
  CreateRahcomSolarSnapshotDto,
  ReplaceRahcomSolarSpecialSystemsDto,
  CreateRahcomTrafficSnapshotDto,
  ImportRahcomTicketsDto,
  DeleteRahcomSystemsBodyDto,
  DeleteRahcomSystemsQueryDto,
  ImportRahcomSystemsDto,
  MergeRahcomAxisDto,
  RahcomActivitiesQueryDto,
  RahcomProvinceQueryDto,
  UpdateRahcomSystemDto,
  UpdateRahcomAxisDto,
  UpdateRahcomMemberProvinceDto,
  UpdateRahcomSelectedProvinceDto,
} from './dto/rahcom.dto';
import { RahcomService } from './rahcom.service';

@Controller('rahcom')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RahcomController {
  constructor(private readonly service: RahcomService) {}

  @Get('axes')
  listAxes(@CurrentUser() user: AuthenticatedUser, @Query() query: RahcomProvinceQueryDto) {
    return this.service.listAxes(user, query.province);
  }
  @Get('me')
  getRahcomAccess(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getRahcomAccess(user);
  }
  @Put('me/province')
  updateMySelectedProvince(@CurrentUser() user: AuthenticatedUser, @Body() body: UpdateRahcomSelectedProvinceDto) {
    return this.service.updateSelectedProvince(user, body.province);
  }
  @Post('axes')
  createAxis(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateRahcomAxisDto) {
    return this.service.createAxis(user, body);
  }
  @Put('axes/:id')
  updateAxis(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: UpdateRahcomAxisDto) {
    return this.service.updateAxis(user, id, body.name);
  }
  @Post('axes/:id/merge')
  mergeAxis(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: MergeRahcomAxisDto) {
    return this.service.mergeAxis(user, id, body.targetAxisId);
  }
  @Delete('axes/:id')
  deleteAxis(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.deleteAxis(user, id);
  }

  @Get('systems')
  listSystems(@CurrentUser() user: AuthenticatedUser, @Query() query: RahcomProvinceQueryDto) {
    return this.service.listSystems(user, query.province);
  }
  @Post('systems/import')
  importSystems(@CurrentUser() user: AuthenticatedUser, @Body() body: ImportRahcomSystemsDto) {
    return this.service.importSystems(user, body);
  }
  @Put('systems/:id')
  updateSystem(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: UpdateRahcomSystemDto) {
    return this.service.updateSystem(user, id, body);
  }
  @Delete('systems/:id')
  deleteSystem(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.deleteSystem(user, id);
  }
  @Delete('systems')
  deleteSystems(@CurrentUser() user: AuthenticatedUser, @Query() query: DeleteRahcomSystemsQueryDto, @Body() body: DeleteRahcomSystemsBodyDto) {
    return this.service.deleteSystems(user, { province: query.province, ids: body.ids });
  }
  @Get('systems/:id/activities')
  listSystemActivities(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.listSystemActivities(user, id);
  }
  @Post('systems/:id/activities')
  createSystemActivity(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: CreateRahcomSystemActivityDto) {
    return this.service.createSystemActivity(user, id, body);
  }
  @Get('activities')
  listActivities(@CurrentUser() user: AuthenticatedUser, @Query() query: RahcomActivitiesQueryDto) {
    return this.service.listActivities(user, query);
  }
  @Post('activities')
  createActivity(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateRahcomActivityDto) {
    return this.service.createActivity(user, body);
  }
  @Get('tickets')
  listImportedTickets(@CurrentUser() user: AuthenticatedUser, @Query() query: RahcomProvinceQueryDto) {
    return this.service.listImportedTickets(user, query.province);
  }
  @Post('tickets/import')
  importTickets(@CurrentUser() user: AuthenticatedUser, @Body() body: ImportRahcomTicketsDto) {
    return this.service.importTickets(user, body);
  }
  @Get('members')
  listProvinceAssignments(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listProvinceAssignments(user);
  }
  @Put('members/:id/province')
  updateProvinceAssignment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: UpdateRahcomMemberProvinceDto) {
    return this.service.updateProvinceAssignment(user, id, body.province ?? null);
  }
  @Get('solar-snapshots')
  listSolarSnapshots(@CurrentUser() user: AuthenticatedUser, @Query() query: RahcomProvinceQueryDto) {
    return this.service.listSolarSnapshots(user, query.province);
  }
  @Post('solar-snapshots')
  createSolarSnapshot(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateRahcomSolarSnapshotDto) {
    return this.service.createSolarSnapshot(user, body);
  }
  @Put('solar-snapshots/:id')
  updateSolarSnapshot(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: CreateRahcomSolarSnapshotDto) {
    return this.service.updateSolarSnapshot(user, id, body);
  }
  @Delete('solar-snapshots/:id')
  deleteSolarSnapshot(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.deleteSolarSnapshot(user, id);
  }
  @Get('solar-special-systems')
  listSolarSpecialSystems(@CurrentUser() user: AuthenticatedUser, @Query() query: RahcomProvinceQueryDto) {
    return this.service.listSolarSpecialSystems(user, query.province);
  }
  @Put('solar-special-systems')
  replaceSolarSpecialSystems(@CurrentUser() user: AuthenticatedUser, @Body() body: ReplaceRahcomSolarSpecialSystemsDto) {
    return this.service.replaceSolarSpecialSystems(user, body);
  }
  @Get('traffic-snapshot')
  listTrafficSnapshot(@CurrentUser() user: AuthenticatedUser, @Query() query: RahcomProvinceQueryDto) {
    return this.service.listTrafficSnapshot(user, query.province);
  }
  @Get('traffic-snapshot/history')
  listTrafficSystemHistory(@CurrentUser() user: AuthenticatedUser, @Query('systemCode') systemCode: string) {
    return this.service.listTrafficSystemHistory(user, systemCode);
  }
  @Post('traffic-snapshots')
  createTrafficSnapshot(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateRahcomTrafficSnapshotDto) {
    return this.service.createTrafficSnapshot(user, body);
  }
  @Post('traffic-snapshot/apply-axes')
  applyTrafficAxes(@CurrentUser() user: AuthenticatedUser) {
    return this.service.applyTrafficAxes(user);
  }
  @Delete('activities/:id')
  deleteActivity(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.deleteActivity(user, id);
  }
}
