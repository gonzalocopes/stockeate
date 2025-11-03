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
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private email: EmailService,
  ) {}

  async register(
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
    role?: UserRole,
    dni?: string,
    cuit?: string,
  ): Promise<{ access_token: string; user: any }> {
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new BadRequestException('El email ya está registrado');

    const hash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hash,
        firstName: firstName || '',
        lastName: lastName || '',
        role: role || 'EMPLOYEE',
        dni: dni || null,
        cuit: cuit || null,
      },
    });
    
    const token = this.sign(user.id, user.email);
    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        dni: user.dni,
        cuit: user.cuit,
      },
    };
  }

  async login(email: string, password: string): Promise<{ access_token: string; user: any }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');

    const token = this.sign(user.id, user.email);
    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        dni: user.dni,
        cuit: user.cuit,
      },
    };
  }

  // -------- Password Reset por email con código de 6 dígitos --------
  async forgot(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Siempre respondemos OK para no filtrar existencia
    if (!user) throw new NotFoundException('El correo no está registrado');

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
    if (!pr) throw new BadRequestException('Código inválido');

    if (isBefore(pr.expiresAt, new Date()))
      throw new BadRequestException('Código expirado');

    const user = await this.prisma.user.findUnique({
      where: { id: pr.userId },
    });
    if (!user) throw new BadRequestException('Usuario no encontrado');

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
  async updateProfile(
    userId: string,
    firstName?: string,
    lastName?: string,
    avatarUrl?: string,
    role?: UserRole,
    dni?: string,
    cuit?: string,
  ): Promise<any> {
    const updateData: any = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    if (role !== undefined) updateData.role = role;
    if (dni !== undefined) updateData.dni = dni;
    if (cuit !== undefined) updateData.cuit = cuit;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      dni: user.dni,
      cuit: user.cuit,
    };
  }

  private sign(sub: string, email: string) {
    return this.jwt.sign({ sub, email });
  }
}
