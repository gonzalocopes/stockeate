import { Body, Controller, Post, Put, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { IsEmail, IsString, MinLength, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from './jwt-auth.guard';

class RegisterDto {
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() role?: UserRole;
  @IsOptional() @IsString() dni?: string;
  @IsOptional() @IsString() cuit?: string;
}
class LoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
}

class ForgotDto {
  @IsEmail() email: string;
}

class ResetDto {
  @IsString() @IsNotEmpty() token: string; // acá va el código de 6 dígitos
  @IsString() @MinLength(6) newPassword: string;
}

class UpdateProfileDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsString() role?: UserRole;
  @IsOptional() @IsString() dni?: string;
  @IsOptional() @IsString() cuit?: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const result = await this.auth.register(
      dto.email,
      dto.password,
      dto.firstName,
      dto.lastName,
      dto.role,
      dto.dni,
      dto.cuit,
    );
    return result;
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const result = await this.auth.login(dto.email, dto.password);
    return result;
  }

  @Post('forgot')
  async forgot(@Body() dto: ForgotDto) {
    await this.auth.forgot(dto.email);
    return { ok: true };
  }

  @Post('reset')
  async reset(@Body() dto: ResetDto) {
    await this.auth.reset(dto.token, dto.newPassword);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile')
  async updateProfile(@Request() req: any, @Body() dto: UpdateProfileDto) {
    const profile = await this.auth.updateProfile(
      req.user.sub,
      dto.firstName,
      dto.lastName,
      dto.avatarUrl,
      dto.role,
      dto.dni,
      dto.cuit,
    );
    return profile;
  }
}
