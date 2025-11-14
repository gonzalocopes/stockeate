import { Controller, Get, Post, Body } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { ApiTags } from '@nestjs/swagger';
import { CreateBranchDto } from './branches.dto';

@ApiTags('Branches')
@Controller('branches')
export class BranchesController {
  constructor(private readonly svc: BranchesService) {}

  @Get()
  findAll() {
    return this.svc.findAll();
  }

  @Post()
  createBranch(@Body() branch: CreateBranchDto) {
    return this.svc.createBranch(branch);
  }
}
