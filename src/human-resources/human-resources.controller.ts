/**
 * مسیر فایل:
 * backend/src/human-resources/human-resources.controller.ts
 *
 * هدف:
 * ارائه endpointهای مدیریت کارکنان و درخواست‌های مرخصی.
 *
 * همه endpointها توسط GlobalAuthGuard محافظت می‌شوند.
 * organizationId هرگز از body یا query خوانده نمی‌شود.
 */

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import {
  EmployeeStatus,
  EmploymentType,
  LeaveRequestStatus,
  LeaveType,
} from '@prisma/client';

import { CurrentUser } from '../core/auth/decorators/current-user.decorator';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { CreateBusinessTripRequestDto } from './dto/create-business-trip-request.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UpdateLeaveRequestStatusDto } from './dto/update-leave-request-status.dto';
import { SaveAttendanceDto } from './dto/save-attendance.dto';
import { SavePayrollDto } from './dto/save-payroll.dto';
import { UpdatePayrollStatusDto } from './dto/update-payroll-status.dto';
import { HumanResourcesService } from './human-resources.service';

type CurrentAuthUser = {
  id: string;
  organizationId: string;
};

@Controller('human-resources')
export class HumanResourcesController {
  constructor(
    private readonly humanResourcesService: HumanResourcesService,
  ) {}

  @Get('access')
  getAccess(@CurrentUser() user: CurrentAuthUser) {
    return this.humanResourcesService.getAccess(user);
  }

  @Get('options')
  getOptions(@CurrentUser() user: CurrentAuthUser) {
    return this.humanResourcesService.getReferenceData(user);
  }

  @Get('attendance')
  getAttendance(@CurrentUser() user: CurrentAuthUser, @Query('date') date?: string) {
    return this.humanResourcesService.getAttendance(user, date);
  }

  @Post('attendance')
  saveAttendance(@CurrentUser() user: CurrentAuthUser, @Body() dto: SaveAttendanceDto) {
    return this.humanResourcesService.saveAttendance(user, dto);
  }

  @Post('attendance/check-in')
  checkIn(@CurrentUser() user: CurrentAuthUser) {
    return this.humanResourcesService.checkIn(user);
  }

  @Post('attendance/check-out')
  checkOut(@CurrentUser() user: CurrentAuthUser) {
    return this.humanResourcesService.checkOut(user);
  }

  @Get('payroll')
  getPayroll(@CurrentUser() user: CurrentAuthUser, @Query('period') period?: string) {
    return this.humanResourcesService.getPayroll(user, period);
  }

  @Post('payroll')
  savePayroll(@CurrentUser() user: CurrentAuthUser, @Body() dto: SavePayrollDto) {
    return this.humanResourcesService.savePayroll(user, dto);
  }

  @Patch('payroll/:id/status')
  updatePayrollStatus(
    @CurrentUser() user: CurrentAuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePayrollStatusDto,
  ) {
    return this.humanResourcesService.updatePayrollStatus(user, id, dto);
  }

  @Get('dashboard')
  getDashboard(@CurrentUser() user: CurrentAuthUser) {
    return this.humanResourcesService.getDashboard(user);
  }

  @Get('employees')
  getEmployees(
    @CurrentUser() user: CurrentAuthUser,
    @Query('search') search?: string,
    @Query('status') status?: EmployeeStatus,
    @Query('employmentType') employmentType?: EmploymentType,
    @Query('branchId') branchId?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.humanResourcesService.getEmployees(user, {
      search,
      status,
      employmentType,
      branchId,
      departmentId,
    });
  }

  @Get('employees/:id')
  getEmployeeById(
    @CurrentUser() user: CurrentAuthUser,
    @Param('id') employeeId: string,
  ) {
    return this.humanResourcesService.getEmployeeById(
      user,
      employeeId,
    );
  }

  @Post('employees')
  createEmployee(
    @CurrentUser() user: CurrentAuthUser,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.humanResourcesService.createEmployee(user, dto);
  }

  @Patch('employees/:id')
  updateEmployee(
    @CurrentUser() user: CurrentAuthUser,
    @Param('id') employeeId: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.humanResourcesService.updateEmployee(
      user,
      employeeId,
      dto,
    );
  }

  @Get('leave-requests')
  getLeaveRequests(
    @CurrentUser() user: CurrentAuthUser,
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: LeaveRequestStatus,
    @Query('leaveType') leaveType?: LeaveType,
  ) {
    return this.humanResourcesService.getLeaveRequests(user, {
      employeeId,
      status,
      leaveType,
    });
  }

  @Get('leave-requests/:id')
  getLeaveRequestById(
    @CurrentUser() user: CurrentAuthUser,
    @Param('id') leaveRequestId: string,
  ) {
    return this.humanResourcesService.getLeaveRequestById(
      user,
      leaveRequestId,
    );
  }

  @Post('leave-requests')
  createLeaveRequest(
    @CurrentUser() user: CurrentAuthUser,
    @Body() dto: CreateLeaveRequestDto,
  ) {
    return this.humanResourcesService.createLeaveRequest(user, dto);
  }

  @Patch('leave-requests/:id/status')
  updateLeaveRequestStatus(
    @CurrentUser() user: CurrentAuthUser,
    @Param('id') leaveRequestId: string,
    @Body() dto: UpdateLeaveRequestStatusDto,
  ) {
    return this.humanResourcesService.updateLeaveRequestStatus(
      user,
      leaveRequestId,
      dto,
    );
  }

  @Get('business-trip-requests')
  getBusinessTripRequests(@CurrentUser() user: CurrentAuthUser, @Query('status') status?: LeaveRequestStatus) {
    return this.humanResourcesService.getBusinessTripRequests(user, status);
  }

  @Post('business-trip-requests')
  createBusinessTripRequest(@CurrentUser() user: CurrentAuthUser, @Body() dto: CreateBusinessTripRequestDto) {
    return this.humanResourcesService.createBusinessTripRequest(user, dto);
  }

  @Patch('business-trip-requests/:id/status')
  updateBusinessTripRequestStatus(@CurrentUser() user: CurrentAuthUser, @Param('id') id: string, @Body() dto: UpdateLeaveRequestStatusDto) {
    return this.humanResourcesService.updateBusinessTripRequestStatus(user, id, dto);
  }
}
