import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminService } from './admin.service';
import { ListOrdersDto } from './dto/list-orders.dto';

@Controller('admin')
@UseGuards(AdminAuthGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  /** Liste paginée des transactions, avec numéro et nom du payeur. */
  @Get('orders')
  listOrders(@Query() query: ListOrdersDto) {
    return this.admin.listOrders(query);
  }
}
