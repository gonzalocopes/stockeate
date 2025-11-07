// src/digitalized-remito/digitalized-remito.controller.ts
import { Controller, Post, Get, Param, UseInterceptors, UploadedFile, Body, Request } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
// Importa tu Guard de autenticación si ya lo tienes, ej: import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DigitalizedRemitoService } from './digitalized-remito.service';
import { ValidationDataDto } from './dto/validation-data.dto'; // 👈 Importa el DTO
@Controller('digitalized-remito')
export class DigitalizedRemitoController {
  constructor(private readonly remitoService: DigitalizedRemitoService) {}

  // --- AÑADIR ESTE MÉTODO COMPLETO ---
  @Post('upload')
  @UseInterceptors(FileInterceptor('file')) // 'file' es el nombre clave que la app móvil debe usar
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('branchId') branchId: string,
    // @Request() req, // Descomenta esto si usas JWT para obtener el usuario del token
  ) {
    // Por ahora, simularemos el ID del usuario. Más adelante vendrá del token JWT.
    const userId = '21406f7f-843f-43ba-bae4-8223b4de7d39'; // <-- Reemplaza con un UUID válido de un usuario en tu BD

    return this.remitoService.createInitialRemito(file, userId, branchId);
  }
  @Get('pending/:branchId')
  findPendingByBranch(@Param('branchId') branchId: string) {
    return this.remitoService.findPendingByBranch(branchId);
  }

  // 2. Endpoint para obtener los detalles de UN remito específico
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.remitoService.findOne(id);
  }

  // 3. Endpoint para recibir los datos validados y actualizar el stock
  @Post(':id/validate')
  validateRemito(
    @Param('id') id: string, 
    @Body() validationData: ValidationDataDto, // 👈 Usa el DTO aquí
  ) {
    return this.remitoService.validateAndFinalizeRemito(id, validationData);
  }

}