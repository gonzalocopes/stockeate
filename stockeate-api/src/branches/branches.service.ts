import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateBranchDto } from './branches.dto';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  createBranch(branch: CreateBranchDto) {
    return this.prisma.branch.create({
      data: {
        name: branch.name,
        address: branch.address,
      },
    });
  }

  findAll() {
    return this.prisma.branch.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, address: true },
    });
  }
}
