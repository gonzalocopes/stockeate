import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { addMinutes, isBefore } from 'date-fns';
import { EmailService } from '../email/email.service';
import { Inject } from '@nestjs/common';
import { LOGGER } from '../logger.provider';
import { Logger } from 'winston';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private email: EmailService,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {
    this.logger.info('AuthService inicializado');
  }

  async register(
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
    dni?: string,
  ): Promise<string> {
    this.logger.info('Prueba de log desde register');
    const existsEmail = await this.prisma.user.findUnique({ where: { email } });
if (existsEmail) {
  this.logger.warn(`Intento de registro con email ya registrado: ${email}`);
  this.logger.info('Test log a archivo desde AuthService');
  throw new BadRequestException('El email ya está registrado');
}
const existsDni = await this.prisma.user.findUnique({ where: { dni } });
if (existsDni) {
  this.logger.warn(`Intento de registro con DNI ya registrado: ${dni}`);
  throw new BadRequestException('El DNI ya está registrado');
}

    const hash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hash,
        firstName: firstName,
        lastName: lastName,
        dni: dni,
      },
    });
    return this.sign(user.id, user.email);
  }

  async login(email: string, password: string): Promise<string> {
  this.logger.info('Entrando al método login');
  const user = await this.prisma.user.findUnique({ where: { email } });
  if (!user) {
    this.logger.info(`Login fallido: usuario no encontrado para email ${email}`);
    throw new UnauthorizedException('Credenciales inválidas');
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    this.logger.warn(`Login fallido: contraseña incorrecta para email ${email}`);
    throw new UnauthorizedException('Credenciales inválidas');
  }

    return this.sign(user.id, user.email);
  }

  // -------- Password Reset por email con código de 6 dígitos --------
  async forgot(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Siempre respondemos OK para no filtrar existencia
    if (!user) {
      this.logger.warn(`Recuperación fallida: correo no registrado ${email}`);
      throw new NotFoundException('El correo no está registrado');
    }

    // invalidar tokens viejos
    await this.prisma.passwordReset.deleteMany({ where: { userId: user.id } });

    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = addMinutes(new Date(), 30);

    await this.prisma.passwordReset.create({
      data: { userId: user.id, token: token, expiresAt },
    });

    await this.email.sendPasswordResetToken(user.email, token);
  }

  async reset(token: string, newPassword: string): Promise<void> {
    const pr = await this.prisma.passwordReset.findFirst({
      where: { token: token },
    });
    if (!pr) {
      this.logger.warn(`Código de recuperación inválido: ${token}`);
      throw new BadRequestException('Código inválido');
    }

    if (isBefore(pr.expiresAt, new Date())) {
      this.logger.warn(`Código de recuperación expirado: ${token}`);
      throw new BadRequestException('Código expirado');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: pr.userId },
    });
    if (!user) {
      this.logger.warn(`Intento de cambio de contraseña para usuario no encontrado: ${pr.userId}`);
      throw new BadRequestException('Usuario no encontrado');
    }

    const hash = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { password: hash },
      }),
      this.prisma.passwordReset.deleteMany({ where: { userId: user.id } }),
    ]);
  }

  // -------- Helpers --------
  private sign(sub: string, email: string) {
    return this.jwt.sign({ sub, email });
  }
}
