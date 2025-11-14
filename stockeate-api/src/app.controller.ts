import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // TODO: Implementar health check para monitoreo en producción
  // @Get('health')
  // getHealth() {
  //   return {
  //     status: 'ok',
  //     timestamp: new Date().toISOString(),
  //     service: 'stockeate-api',
  //     database: 'connected', // Verificar conexión a DB
  //     uptime: process.uptime()
  //   };
  // }
}
