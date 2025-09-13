import { Controller, Get } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Branches')
@Controller('branches')
export class BranchesController {
  constructor(private readonly svc: BranchesService) {}

  @Get()
  findAll() {
    return this.svc.findAll();
  }
}
