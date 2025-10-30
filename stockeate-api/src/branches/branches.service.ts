import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.branch.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, location: true },
    });
  }
}
