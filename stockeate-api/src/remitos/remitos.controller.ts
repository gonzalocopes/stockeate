import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RemitosService } from './remitos.service';
import {
  CreateRemitoDto,
  UpdateRemitoDto,
  GetRemitosQueryDto,
  RemitoType,
  GetMonthlyStatsQueryDto,
  GetLast6MonthsStatsQueryDto,
} from './remitos.dto';
import { ApiOperation } from '@nestjs/swagger';

@Controller('remitos')
export class RemitosController {
  constructor(private readonly remitosService: RemitosService) {}

  @Post()
  @ApiOperation({ summary: 'Crear nuevo remito (IN o OUT)' })
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createRemitoDto: CreateRemitoDto) {
    return this.remitosService.create(createRemitoDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los remitos con filtros opcionales' })
  findAll(@Query() query: GetRemitosQueryDto) {
    return this.remitosService.findAll(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Obtener estadísticas de remitos' })
  getStats(@Query('branchId') branchId?: string) {
    return this.remitosService.getStats(branchId);
  }

  @Get('type/:type')
  @ApiOperation({ summary: 'Obtener remitos por tipo (IN o OUT)' })
  findByType(
    @Param('type') type: RemitoType,
    @Query('branchId') branchId?: string,
  ) {
    return this.remitosService.findByType(type, branchId);
  }

  @Get('branch/:branchId')
  @ApiOperation({ summary: 'Obtener remitos por sucursal' })
  findByBranch(@Param('branchId') branchId: string) {
    return this.remitosService.findByBranch(branchId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener remito por ID' })
  findOne(@Param('id') id: string) {
    return this.remitosService.findOne(id);
  }

  @Get('stats/monthly')
  @ApiOperation({ summary: 'Obtener estadísticas mensuales de remitos' })
  getMonthlyStats(@Query() query: GetMonthlyStatsQueryDto) {
    return this.remitosService.getMonthlyStats(query);
  }

  @Get('stats/last-6-months/remitos')
  @ApiOperation({
    summary:
      'Obtener estadísticas de remitos de los últimos 6 meses para una sucursal',
  })
  getLast6MonthsRemitosStats(@Query() query: GetLast6MonthsStatsQueryDto) {
    return this.remitosService.getLast6MonthsRemitosStats(query.branchId);
  }

  @Get('stats/last-6-months/productos')
  @ApiOperation({
    summary:
      'Obtener estadísticas de productos de los últimos 6 meses para una sucursal',
  })
  getLast6MonthsProductsStats(@Query() query: GetLast6MonthsStatsQueryDto) {
    return this.remitosService.getLast6MonthsProductsStats(query.branchId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar remito' })
  update(@Param('id') id: string, @Body() updateRemitoDto: UpdateRemitoDto) {
    return this.remitosService.update(id, updateRemitoDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar remito (revierte stock)' })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.remitosService.remove(id);
  }
}
