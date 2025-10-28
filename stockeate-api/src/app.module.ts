// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { SyncModule } from './sync/sync.module';
import { BranchesModule } from './branches/branches.module';
import { EmailModule } from './email/email.module';
import { PrismaService } from './prisma.service';
import { RemitosModule } from './remitos/remitos.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    ProductsModule,
    SyncModule,
    BranchesModule,
    EmailModule, // 👈 agregado
    RemitosModule,
  ],
  providers: [PrismaService], // 👈 agregado
})
export class AppModule {}
