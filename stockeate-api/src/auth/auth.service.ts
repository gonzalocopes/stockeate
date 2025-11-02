import {
  Injectable,
  BadRequestException,
  UnauthorizedException,

} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { addMinutes, isBefore } from 'date-fns';
import { EmailService } from '../email/email.service';

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


  async forgot(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    
    if (!user) return;

    await this.prisma.passwordReset.deleteMany({ where: { userId: user.id } });

    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = addMinutes(new Date(), 30);

    await this.prisma.passwordReset.create({
      data: { userId: user.id, token: token, expiresAt },
    });

    try {
      await this.email.sendPasswordResetToken(user.email, token);
    } catch (error) {
      console.error('[AuthService] Error enviando email:', {
        email: user.email,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
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

  
  private sign(sub: string, email: string) {
    return this.jwt.sign({ sub, email });
  }
}
