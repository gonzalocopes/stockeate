import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { EmailModule } from '../email/email.module';
import { PassportModule } from '@nestjs/passport'; // <-- 1. Importar Passport
import { JwtStrategy } from './jwt.strategy';     // <-- 2. Importar la Estrategia

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }), // <-- 3. Registrar Passport
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'devsecret',
      signOptions: { expiresIn: '7d' },
    }),
    EmailModule,
  ],
  providers: [
    AuthService, 
    PrismaService, 
    JwtStrategy, // <-- 4. Añadir JwtStrategy como un provider
  ],
  controllers: [AuthController],
  exports: [
    AuthService, 
    PassportModule, // <-- 5. Exportar PassportModule
    JwtStrategy,    // <-- 5. Exportar JwtStrategy
  ],
})
export class AuthModule {}