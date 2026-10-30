import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminService } from './admin.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
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

  /** Comptes du tableau de bord (sans les hash de mot de passe). */
  @Get('users')
  listUsers() {
    return this.admin.listUsers();
  }

  /** Crée un compte : réservé à un admin déjà connecté. */
  @Post('users')
  createUser(@Body() dto: CreateAdminUserDto) {
    return this.admin.createUser(dto.username, dto.password);
  }
}
