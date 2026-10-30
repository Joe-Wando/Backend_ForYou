import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListOrdersDto } from './dto/list-orders.dto';
import { hashPassword } from './password';

export interface AdminAccount {
  id: string;
  username: string;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminOrder {
  order_id: string;
  status: string;
  amount: number;
  fees: number | null;
  currency: string;
  method: string;
  customerName: string | null;
  customerPhone: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOrdersPage {
  items: AdminOrder[];
  total: number;
  page: number;
  pageSize: number;
  /** Totaux sur l'ensemble des commandes filtrées ayant abouti (status = completed). */
  completed: { count: number; amount: number; fees: number };
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listOrders(query: ListOrdersDto): Promise<AdminOrdersPage> {
    const { page, pageSize } = query;
    const where: Prisma.OrderWhereInput = {};

    if (query.status) where.status = query.status.toLowerCase();
    if (query.method) where.method = query.method;

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { orderId: { contains: search } },
        { customerName: { contains: search } },
        { customerPhone: { contains: search.replace(/\s/g, '') } },
      ];
    }

    const [orders, total, completed] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
      this.prisma.order.aggregate({
        where: { ...where, status: 'completed' },
        _count: { _all: true },
        _sum: { amount: true, fees: true },
      }),
    ]);

    return {
      items: orders.map((o) => ({
        order_id: o.orderId,
        status: o.status,
        amount: o.amount,
        fees: o.fees,
        currency: o.currency,
        method: o.method,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        paidAt: o.paidAt ? o.paidAt.toISOString() : null,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      completed: {
        count: completed._count._all,
        amount: completed._sum.amount ?? 0,
        fees: completed._sum.fees ?? 0,
      },
    };
  }

  async listUsers(): Promise<AdminAccount[]> {
    const users = await this.prisma.adminUser.findMany({ orderBy: { createdAt: 'asc' } });
    return users.map(toAccount);
  }

  async createUser(username: string, password: string): Promise<AdminAccount> {
    try {
      const user = await this.prisma.adminUser.create({
        data: { username, passwordHash: await hashPassword(password) },
      });
      return toAccount(user);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`L'identifiant "${username}" est déjà utilisé.`);
      }
      throw err;
    }
  }
}

function toAccount(user: {
  id: string;
  username: string;
  lastLoginAt: Date | null;
  createdAt: Date;
}): AdminAccount {
  return {
    id: user.id,
    username: user.username,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
  };
}
