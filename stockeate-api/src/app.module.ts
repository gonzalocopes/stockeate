import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { SyncModule } from './sync/sync.module';
import { BranchesModule } from './branches/branches.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    ProductsModule,
    SyncModule,
    BranchesModule,
  ],
})
export class AppModule {}
