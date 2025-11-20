import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });
  }

  async sendPasswordResetToken(email: string, token: string) {
    const subject = `Stockeate - Código de recuperación: ${token}`;
    const html = `
      <div style="font-family: Arial, sans-serif; line-height:1.5; color:#0b1220">
        <h2 style="margin:0 0 12px">Stockeate</h2>
        <p>Recibimos una solicitud para restablecer tu contraseña.</p>
        <p>Tu código de verificación es:</p>
        <div style="font-size:24px; font-weight:700; letter-spacing:4px; margin:12px 0; padding:12px 16px; background:#f1f5f9; border-radius:8px; display:inline-block;">
          ${token}
        </div>
        <p>Este código vence en 30 minutos.</p>
        <p>Si no solicitaste este cambio, podés ignorar este email.</p>
        <p style="margin-top:24px; font-size:12px; color:#475569">© ${new Date().getFullYear()} Stockeate</p>
      </div>
    `;

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await this.transporter.sendMail({
        from: `"Stockeate" <${process.env.MAIL_USER}>`,
        to: email,
        subject,
        html,
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      throw new InternalServerErrorException(
        'No se pudo enviar el email de recuperación',
      );
    }
  }
}
