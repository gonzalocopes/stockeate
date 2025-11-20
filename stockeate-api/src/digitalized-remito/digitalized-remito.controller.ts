// src/digitalized-remito/digitalized-remito.controller.ts
import { 
  Controller,
  Post,
  Get,
  Param,
  UseInterceptors,
  UploadedFile,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DigitalizedRemitoService } from './digitalized-remito.service';
import { ValidationDataDto } from './dto/validation-data.dto';

@Controller('digitalized-remito')
export class DigitalizedRemitoController {
  constructor(private readonly remitoService: DigitalizedRemitoService) {}

  /**
   * SUBIR ARCHIVO
   * De momento SIN guard para no bloquear por 401.
   * Si req.user existe (porque en el futuro le agregás guard global),
   * usamos ese userId; si no, guardamos "anonymous".
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('branchId') branchId: string,
    @Request() req: any,
  ) {
    const userId = req.user?.sub ?? 'anonymous';
    return this.remitoService.createInitialRemito(file, userId, branchId);
  }

  @Get('pending/:branchId')
  @UseGuards(JwtAuthGuard)
  findPendingByBranch(@Param('branchId') branchId: string) {
    return this.remitoService.findPendingByBranch(branchId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.remitoService.findOne(id);
  }

  @Post(':id/validate')
  @UseGuards(JwtAuthGuard)
  validateRemito(
    @Param('id') id: string,
    @Body() validationData: ValidationDataDto,
  ) {
    return this.remitoService.validateAndFinalizeRemito(id, validationData);
  }
}
