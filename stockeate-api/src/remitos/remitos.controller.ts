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
} from './remitos.dto';

@Controller('remitos')
export class RemitosController {
  constructor(private readonly remitosService: RemitosService) {}

  // POST /remitos - Crear nuevo remito
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createRemitoDto: CreateRemitoDto) {
    return this.remitosService.create(createRemitoDto);
  }

  // GET /remitos - Obtener todos los remitos con filtros opcionales
  @Get()
  findAll(@Query() query: GetRemitosQueryDto) {
    return this.remitosService.findAll(query);
  }

  // GET /remitos/branch/:branchId - Obtener remitos por sucursal
  @Get('branch/:branchId')
  findByBranch(@Param('branchId') branchId: string) {
    return this.remitosService.findByBranch(branchId);
  }

  // GET /remitos/:id - Obtener remito por ID
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.remitosService.findOne(id);
  }

  // PATCH /remitos/:id - Actualizar remito
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRemitoDto: UpdateRemitoDto) {
    return this.remitosService.update(id, updateRemitoDto);
  }

  // DELETE /remitos/:id - Eliminar remito (revierte stock)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.remitosService.remove(id);
  }
}
