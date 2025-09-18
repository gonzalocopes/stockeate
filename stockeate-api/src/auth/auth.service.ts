import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { addMinutes, isBefore } from 'date-fns';
import { EmailService } from '../email/email.service';

function gen6() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 dígitos
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private email: EmailService,
  ) {}

  async register(email: string, password: string): Promise<string> {
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new BadRequestException('El email ya está registrado');

    const hash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: { email, password: hash },
    });
    return this.sign(user.id, user.email);
  }

  async login(email: string, password: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');

    return this.sign(user.id, user.email);
  }

  // -------- Password Reset por email con código de 6 dígitos --------

  async forgot(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // siempre respondemos OK para no filtrar existencia
    if (!user) return;

    // invalidar tokens viejos
    await this.prisma.passwordReset.deleteMany({ where: { userId: user.id } });

    const code = gen6();
    const expiresAt = addMinutes(new Date(), 30);

    await this.prisma.passwordReset.create({
      data: { userId: user.id, token: code, expiresAt }, // usamos token para el código
    });

    await this.email.sendPasswordResetCode(user.email, code);
  }

  async reset(tokenOrCode: string, newPassword: string): Promise<void> {
    const pr = await this.prisma.passwordReset.findUnique({ where: { token: tokenOrCode } });
    if (!pr) throw new BadRequestException('Código inválido');

    if (isBefore(pr.expiresAt, new Date()))
      throw new BadRequestException('Código expirado');

    const user = await this.prisma.user.findUnique({ where: { id: pr.userId } });
    if (!user) throw new BadRequestException('Usuario no encontrado');

    const hash = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { password: hash } }),
      this.prisma.passwordReset.deleteMany({ where: { userId: user.id } }),
    ]);
  }

  // -------- Helpers --------
  private sign(sub: string, email: string) {
    return this.jwt.sign({ sub, email });
  }
}
