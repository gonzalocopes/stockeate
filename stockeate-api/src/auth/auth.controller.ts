import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

class RegisterDto {
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
}

class LoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const token = await this.auth.register(dto.email, dto.password);
    return { access_token: token };
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const token = await this.auth.login(dto.email, dto.password);
    return { access_token: token };
  }
}
