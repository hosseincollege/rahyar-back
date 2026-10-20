import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import type { AuthenticatedUser } from '../../core/auth/strategies/jwt.strategy';
import {
  AssignDepartmentEmployeeDto,
  CreateDepartmentTeamDto,
  SetDepartmentManagerDto,
  SetEmployeeManagerDto,
  UpdateDepartmentTeamDto,
} from './dto/department-structure.dto';
import { DepartmentStructureService } from './department-structure.service';

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DepartmentStructureController {
  constructor(private readonly structureService: DepartmentStructureService) {}

  @Get('departments/:id/overview')
  getOverview(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.structureService.getOverview(id.trim(), user);
  }

  @Get('departments/:id/available-employees')
  getAvailableEmployees(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.structureService.getAvailableEmployees(id.trim(), user);
  }

  @Put('departments/:id/manager')
  setDepartmentManager(
    @Param('id') id: string,
    @Body() dto: SetDepartmentManagerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.structureService.setDepartmentManager(
      id.trim(),
      dto.managerEmployeeId,
      user,
    );
  }

  @Post('departments/:id/employees')
  assignEmployee(
    @Param('id') id: string,
    @Body() dto: AssignDepartmentEmployeeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.structureService.assignEmployee(id.trim(), dto.employeeId, user);
  }

  @Put('departments/:id/employees/:employeeId/manager')
  setEmployeeManager(
    @Param('id') id: string,
    @Param('employeeId') employeeId: string,
    @Body() dto: SetEmployeeManagerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.structureService.setEmployeeManager(
      id.trim(),
      employeeId.trim(),
      dto.managerId,
      user,
    );
  }

  @Delete('departments/:id/employees/:employeeId')
  removeEmployee(
    @Param('id') id: string,
    @Param('employeeId') employeeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.structureService.removeEmployee(
      id.trim(),
      employeeId.trim(),
      user,
    );
  }

  @Post('departments/:id/teams')
  createTeam(
    @Param('id') id: string,
    @Body() dto: CreateDepartmentTeamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.structureService.createTeam(id.trim(), dto, user);
  }

  @Put('teams/:teamId')
  updateTeam(
    @Param('teamId') teamId: string,
    @Body() dto: UpdateDepartmentTeamDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.structureService.updateTeam(teamId.trim(), dto, user);
  }

  @Delete('teams/:teamId')
  deleteTeam(
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.structureService.deleteTeam(teamId.trim(), user);
  }
}
