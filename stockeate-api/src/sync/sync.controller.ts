import { Body, Controller, Post } from '@nestjs/common';
import { SyncService } from './sync.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('sync')
export class SyncController {
  constructor(private sync: SyncService) {}

  @Post()
  process(@Body() dto: any) {
    return this.sync.process(dto); // { branchId, products, stockMoves, remitos, remitoItems }
  }
}
