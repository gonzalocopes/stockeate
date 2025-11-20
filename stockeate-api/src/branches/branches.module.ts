import { Module } from '@nestjs/common';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [BranchesController],
  providers: [BranchesService, PrismaService],
})
export class BranchesModule {}
