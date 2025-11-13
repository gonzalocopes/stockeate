import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  IsEmail,
  IsString,
  MinLength,
  IsNotEmpty,
  Length,
  Matches,
} from 'class-validator';
import { ApiTags } from '@nestjs/swagger';

class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @Length(2, 50)
  firstName: string;

  @IsString()
  @Length(2, 50)
  lastName: string;

  @IsString()
  @Length(7, 8)
  @Matches(/^[1-9]\d{6,7}$/)
  dni: string;
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

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const token = await this.auth.register(
      dto.email,
      dto.password,
      dto.firstName,
      dto.lastName,
      dto.dni,
    );
    return { access_token: token };
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const token = await this.auth.login(dto.email, dto.password);
    return { access_token: token };
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
}
