// src/digitalized-remito/digitalized-remito.controller.ts
import { 
  Controller, Post, Get, Param, UseInterceptors, 
  UploadedFile, Body, Request, UseGuards // <-- 1. Importar Request y UseGuards
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // <-- 2. Importar tu Guard de JWT
import { DigitalizedRemitoService } from './digitalized-remito.service';
import { ValidationDataDto } from './dto/validation-data.dto';

@Controller('digitalized-remito')
export class DigitalizedRemitoController {
  constructor(private readonly remitoService: DigitalizedRemitoService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard) // <-- 3. Proteger la ruta (asegura que req.user exista)
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('branchId') branchId: string,
    @Request() req: any, // <-- 4. Inyectar el objeto Request
  ) {
    // --- 5. SOLUCIÓN: Obtenemos el userId real desde el token JWT ---
    // (Asegúrate de que 'req.user.sub' sea la propiedad correcta de tu payload de JWT)
    const userId = req.user.sub; 

    return this.remitoService.createInitialRemito(file, userId, branchId);
  }

  @Get('pending/:branchId')
  @UseGuards(JwtAuthGuard) // <-- Proteger esta ruta también
  findPendingByBranch(@Param('branchId') branchId: string) {
    return this.remitoService.findPendingByBranch(branchId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard) // <-- Proteger esta ruta también
  findOne(@Param('id') id: string) {
    return this.remitoService.findOne(id);
  }

  @Post(':id/validate')
  @UseGuards(JwtAuthGuard) // <-- Proteger esta ruta también
  validateRemito(
    @Param('id') id: string, 
    @Body() validationData: ValidationDataDto,
  ) {
    return this.remitoService.validateAndFinalizeRemito(id, validationData);
  }
}