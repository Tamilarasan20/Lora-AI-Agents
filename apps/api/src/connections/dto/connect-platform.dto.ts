import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUrl } from 'class-validator';

export class GetOAuthUrlDto {
  @ApiProperty({ example: 'instagram' })
  @IsString()
  platform: string;

  @ApiProperty({ example: 'https://app.loraloop.com/connections/callback' })
  @IsUrl()
  redirectUri: string;
}

export class ExchangeCodeDto {
  @ApiProperty({ example: 'instagram' })
  @IsString()
  platform: string;

  @ApiProperty()
  @IsString()
  code: string;

  @ApiProperty()
  @IsUrl()
  redirectUri: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;
}
