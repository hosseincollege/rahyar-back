// Commerce inventory endpoints.

import { Controller, Get, Post, Body } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import {
  CreateProductDto,
  CreateWarehouseDto,
  CreateReceiptDto,
  CreateIssueDto,
  CreateTransferDto,
} from './dto/inventory.dto';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../core/auth/strategies/jwt.strategy';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('summary')
  async getSummary(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.inventoryService.getSummary(user);
    return { success: true, data };
  }

  @Get('products')
  async getProducts(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.inventoryService.getProducts(user);
    return { success: true, data };
  }

  @Post('products')
  async createProduct(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.inventoryService.createProduct(user, dto);
    return { success: true, data };
  }

  @Get('warehouses')
  async getWarehouses(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.inventoryService.getWarehouses(user);
    return { success: true, data };
  }

  @Post('warehouses')
  async createWarehouse(
    @Body() dto: CreateWarehouseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.inventoryService.createWarehouse(user, dto);
    return { success: true, data };
  }

  @Get('balances')
  async getBalances(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.inventoryService.getBalances(user);
    return { success: true, data };
  }

  @Get('movements')
  async getMovements(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.inventoryService.getMovements(user);
    return { success: true, data };
  }

  @Post('receipts')
  async createReceipt(
    @Body() dto: CreateReceiptDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.inventoryService.createReceipt(user, dto);
    return { success: true, data };
  }

  @Post('issues')
  async createIssue(
    @Body() dto: CreateIssueDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.inventoryService.createIssue(user, dto);
    return { success: true, data };
  }

  @Post('transfers')
  async createTransfer(
    @Body() dto: CreateTransferDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.inventoryService.createTransfer(user, dto);
    return { success: true, data };
  }
}
