import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../core/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import type { AuthenticatedUser } from '../core/auth/jwt.strategy';
import {
  CreateRahcomActivityDto,
  CreateRahcomSystemDto,
  SaveRahcomDailyWorkflowDto,
  CreateRahcomSystemActivityDto,
  CreateRahcomSolarSnapshotDto,
  ReplaceRahcomSolarSpecialSystemsDto,
  CreateRahcomTrafficSnapshotDto,
  ImportRahcomTicketsDto,
  ImportRahcomSystemsBatchDto,
  ReplaceRahcomRoadListDto,
  DeleteRahcomSystemsBodyDto,
  DeleteRahcomSystemsQueryDto,
  ImportRahcomSystemsDto,
  RahcomActivitiesQueryDto,
  RahcomProvinceQueryDto,
  RahcomSystemSearchQueryDto,
  RahcomSystemLookupDto,
  RahcomTrafficSnapshotDatesQueryDto,
  UpdateRahcomSystemDto,
  UpdateRahcomMemberProvinceDto,
  UpdateRahcomSelectedProvinceDto,
  UpdateRahcomImportedTicketDescriptionDto,
  ReplaceRahcomBillIdentifierListDto,
  ReplaceRahcomSitesListDto,
  ReplaceRahcomMissionListDto,
  ReplaceRahcomInvoiceListDto,
  SaveRahcomMissionDefaultsDto,
  CreateRahcomInventoryEntryDto,
  CreateRahcomInventoryRequestDto,
  UpdateRahcomInventoryRequestDto,
} from './rahcom.dto';
import { RahcomService } from './rahcom.service';

@Controller('rahcom')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RahcomController {
  constructor(private readonly service: RahcomService) {}

  @Get('me')
  getRahcomAccess(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getRahcomAccess(user);
  }
  @Put('me/province')
  updateMySelectedProvince(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateRahcomSelectedProvinceDto,
  ) {
    return this.service.updateSelectedProvince(user, body.province);
  }
  @Get('systems')
  listSystems(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RahcomProvinceQueryDto,
  ) {
    return this.service.listSystems(user, query.province);
  }
  @Get('sites')
  listSites(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RahcomProvinceQueryDto,
  ) {
    return this.service.listSites(user, query.province);
  }
  @Put('sites')
  replaceSites(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ReplaceRahcomSitesListDto,
  ) {
    return this.service.replaceSites(user, body);
  }
  @Get('missions')
  listMissions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RahcomProvinceQueryDto,
  ) {
    return this.service.listMissions(user, query.province);
  }
  @Put('missions')
  replaceMissions(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ReplaceRahcomMissionListDto,
  ) {
    return this.service.replaceMissions(user, body);
  }
  @Get('missions/defaults')
  getMissionDefaults(@CurrentUser() user: AuthenticatedUser, @Query() query: RahcomProvinceQueryDto) {
    return this.service.getMissionDefaults(user, query.province);
  }
  @Put('missions/defaults')
  saveMissionDefaults(@CurrentUser() user: AuthenticatedUser, @Body() body: SaveRahcomMissionDefaultsDto) {
    return this.service.saveMissionDefaults(user, body);
  }
  @Get('systems/search')
  searchSystems(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RahcomSystemSearchQueryDto,
  ) {
    return this.service.searchSystems(user, query.province, query.q);
  }
  @Post('systems/lookup')
  lookupSystems(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RahcomSystemLookupDto,
  ) {
    return this.service.lookupSystems(user, body);
  }
  @Post('systems')
  createSystem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateRahcomSystemDto,
  ) {
    return this.service.createSystem(user, body);
  }
  @Post('systems/import')
  importSystems(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ImportRahcomSystemsDto,
  ) {
    return this.service.importSystems(user, body);
  }
  @Post('systems/import-batch')
  importSystemsBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ImportRahcomSystemsBatchDto,
  ) {
    return this.service.importSystems(user, body);
  }
  @Put('systems/:id')
  updateSystem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateRahcomSystemDto,
  ) {
    return this.service.updateSystem(user, id, body);
  }
  @Delete('systems/:id')
  deleteSystem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.deleteSystem(user, id);
  }
  @Delete('systems')
  deleteSystems(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DeleteRahcomSystemsQueryDto,
    @Body() body: DeleteRahcomSystemsBodyDto,
  ) {
    return this.service.deleteSystems(user, {
      province: query.province,
      ids: body.ids,
    });
  }
  @Get('systems/:id/activities')
  listSystemActivities(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('date') date: string,
  ) {
    return this.service.listSystemActivities(user, id, date);
  }
  @Post('systems/:id/activities')
  createSystemActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: CreateRahcomSystemActivityDto,
  ) {
    return this.service.createSystemActivity(user, id, body);
  }
  @Get('activities')
  listActivities(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RahcomActivitiesQueryDto,
  ) {
    return this.service.listActivities(user, query);
  }
  @Post('activities')
  createActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateRahcomActivityDto,
  ) {
    return this.service.createActivity(user, body);
  }
  @Put('activities/daily-workflow')
  saveDailyWorkflow(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SaveRahcomDailyWorkflowDto,
  ) {
    return this.service.saveDailyWorkflow(user, body);
  }
  @Get('tickets')
  listImportedTickets(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RahcomProvinceQueryDto,
  ) {
    return this.service.listImportedTickets(user, query.province, query.date);
  }
  @Get('tickets/dates')
  listImportedTicketDates(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RahcomTrafficSnapshotDatesQueryDto,
  ) {
    return this.service.listImportedTicketDates(
      user,
      query.province,
      query.from,
      query.to,
    );
  }
  @Post('tickets/import')
  importTickets(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ImportRahcomTicketsDto,
  ) {
    return this.service.importTickets(user, body);
  }
  @Put('tickets/:id/description')
  updateImportedTicketDescription(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateRahcomImportedTicketDescriptionDto,
  ) {
    return this.service.updateImportedTicketDescription(
      user,
      id,
      body.description,
    );
  }
  @Get('road-list')
  getRoadList(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RahcomProvinceQueryDto,
  ) {
    return this.service.getRoadList(user, query.province, query.date);
  }
  @Get('bill-identifiers')
  getBillIdentifiers(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RahcomProvinceQueryDto,
  ) {
    return this.service.getBillIdentifiers(user, query.province);
  }
  @Get('invoices')
  getInvoices(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RahcomProvinceQueryDto,
  ) {
    return this.service.getInvoices(user, query.province);
  }
  @Put('invoices')
  replaceInvoices(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ReplaceRahcomInvoiceListDto,
  ) {
    return this.service.replaceInvoices(user, body);
  }
  @Get('invoice-attachments')
  getInvoiceAttachments(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RahcomProvinceQueryDto,
  ) {
    return this.service.getInvoiceAttachments(user, query.province);
  }
  @Post('invoice-attachments')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }),
  )
  uploadInvoiceAttachment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { province?: string; invoiceNumber?: string; category?: string },
    @UploadedFile()
    file:
      | { buffer: Buffer; originalname: string; mimetype: string; size: number }
      | undefined,
  ) {
    return this.service.uploadInvoiceAttachment(user, body, file);
  }
  @Get('invoice-attachments/:id/file')
  async getInvoiceAttachmentFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const file = await this.service.getInvoiceAttachmentFile(user, id);
    const disposition = `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`;
    return new StreamableFile(file.content, {
      type: file.mimeType,
      disposition,
    });
  }
  @Get('inventory')
  listInventory(@CurrentUser() user: AuthenticatedUser, @Query() query: RahcomProvinceQueryDto) {
    return this.service.listInventory(user, query.province);
  }
  @Post('inventory')
  createInventory(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateRahcomInventoryEntryDto) {
    return this.service.createInventory(user, body);
  }
  @Delete('inventory/:id')
  deleteInventory(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.deleteInventory(user, id);
  }
  @Get('inventory-requests')
  listInventoryRequests(@CurrentUser() user: AuthenticatedUser, @Query() query: RahcomProvinceQueryDto) {
    return this.service.listInventoryRequests(user, query.province);
  }
  @Post('inventory-requests')
  createInventoryRequest(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateRahcomInventoryRequestDto) {
    return this.service.createInventoryRequest(user, body);
  }
  @Put('inventory-requests/:id')
  updateInventoryRequest(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: UpdateRahcomInventoryRequestDto) {
    return this.service.updateInventoryRequest(user, id, body);
  }
  @Put('bill-identifiers')
  replaceBillIdentifiers(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ReplaceRahcomBillIdentifierListDto,
  ) {
    return this.service.replaceBillIdentifiers(user, body);
  }
  @Get('road-list/dates')
  getRoadListDates(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RahcomTrafficSnapshotDatesQueryDto,
  ) {
    return this.service.listRoadListDates(
      user,
      query.province,
      query.from,
      query.to,
    );
  }
  @Put('road-list')
  replaceRoadList(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ReplaceRahcomRoadListDto,
  ) {
    return this.service.replaceRoadList(user, body);
  }
  @Get('members')
  listProvinceAssignments(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listProvinceAssignments(user);
  }
  @Put('members/:id/province')
  updateProvinceAssignment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateRahcomMemberProvinceDto,
  ) {
    return this.service.updateProvinceAssignment(
      user,
      id,
      body.province ?? null,
    );
  }
  @Get('solar-snapshots')
  listSolarSnapshots(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RahcomProvinceQueryDto,
  ) {
    return this.service.listSolarSnapshots(user, query.province, query.date);
  }
  @Get('solar-snapshots/dates')
  listSolarSnapshotDates(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RahcomTrafficSnapshotDatesQueryDto,
  ) {
    return this.service.listSolarSnapshotDates(
      user,
      query.province,
      query.from,
      query.to,
    );
  }
  @Post('solar-snapshots')
  createSolarSnapshot(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateRahcomSolarSnapshotDto,
  ) {
    return this.service.createSolarSnapshot(user, body);
  }
  @Put('solar-snapshots/:id')
  updateSolarSnapshot(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: CreateRahcomSolarSnapshotDto,
  ) {
    return this.service.updateSolarSnapshot(user, id, body);
  }
  @Delete('solar-snapshots/:id')
  deleteSolarSnapshot(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.deleteSolarSnapshot(user, id);
  }
  @Get('solar-special-systems')
  listSolarSpecialSystems(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RahcomProvinceQueryDto,
  ) {
    return this.service.listSolarSpecialSystems(user, query.province);
  }
  @Put('solar-special-systems')
  replaceSolarSpecialSystems(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ReplaceRahcomSolarSpecialSystemsDto,
  ) {
    return this.service.replaceSolarSpecialSystems(user, body);
  }
  @Get('traffic-snapshot')
  listTrafficSnapshot(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RahcomProvinceQueryDto,
  ) {
    return this.service.listTrafficSnapshot(user, query.province, query.date);
  }
  @Get('traffic-snapshot/dates')
  listTrafficSnapshotDates(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RahcomTrafficSnapshotDatesQueryDto,
  ) {
    return this.service.listTrafficSnapshotDates(
      user,
      query.province,
      query.from,
      query.to,
    );
  }
  @Get('traffic-snapshot/history')
  listTrafficSystemHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('systemCode') systemCode: string,
    @Query('date') date: string,
  ) {
    return this.service.listTrafficSystemHistory(user, systemCode, date);
  }
  @Post('traffic-snapshots')
  createTrafficSnapshot(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateRahcomTrafficSnapshotDto,
  ) {
    return this.service.createTrafficSnapshot(user, body);
  }
  @Post('traffic-snapshot/apply-axes')
  applyTrafficAxes(
    @CurrentUser() user: AuthenticatedUser,
    @Query('date') date: string,
  ) {
    return this.service.applyTrafficAxes(user, date);
  }
  @Delete('activities/:id')
  deleteActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.service.deleteActivity(user, id);
  }
}
