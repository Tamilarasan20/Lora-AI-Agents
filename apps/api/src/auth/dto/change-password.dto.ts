import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPassword1!' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ example: 'NewPassword1!' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}
