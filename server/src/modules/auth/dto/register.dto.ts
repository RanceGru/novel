// 注册请求 DTO
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ description: '邮箱', example: 'user@example.com' })
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email: string;

  @ApiProperty({ description: '密码 (8-64位)', example: 'password123' })
  @IsString()
  @MinLength(8, { message: '密码至少8位' })
  @MaxLength(64, { message: '密码最多64位' })
  password: string;

  @ApiProperty({ description: '显示名称', required: false, example: '张三' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;
}
