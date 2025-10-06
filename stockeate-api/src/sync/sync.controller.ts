import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { SyncService } from './sync.service';

@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  /** Pull para clientes móviles */
  @Get('pull')
  async pull(
    @Query('branchId') branchId: string,
    @Query('since') since?: string,
  ) {
    if (!branchId) throw new BadRequestException('branchId is required');
    const nSince = since ? Number(since) : undefined;
    return this.sync.pull(branchId, nSince);
  }

  /** Mantengo tu ruta existente para “push” (productos, movimientos, remitos) */
  @Post()
  process(@Body() dto: any) {
    return this.sync.process(dto);
  }
}
