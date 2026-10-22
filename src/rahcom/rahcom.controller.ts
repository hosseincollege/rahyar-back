import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../core/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import type { AuthenticatedUser } from '../core/auth/strategies/jwt.strategy';
import {
  CreateRahcomActivityDto,
  CreateRahcomSystemActivityDto,
  DeleteRahcomSystemsBodyDto,
  DeleteRahcomSystemsQueryDto,
  ImportRahcomSystemsDto,
  RahcomActivitiesQueryDto,
  RahcomProvinceQueryDto,
  UpdateRahcomSystemDto,
} from './dto/rahcom.dto';
import { RahcomService } from './rahcom.service';

@Controller('rahcom')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RahcomController {
  constructor(private readonly service: RahcomService) {}

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
    return this.service.listActivities(user, query.date);
  }
  @Post('activities')
  createActivity(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateRahcomActivityDto) {
    return this.service.createActivity(user, body);
  }
  @Delete('activities/:id')
  deleteActivity(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.deleteActivity(user, id);
  }
}
