import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStrategyDto {
  @ApiProperty({ example: 'default' })
  @IsString()
  businessId: string;

  @ApiProperty({ example: 'Increase sales this month' })
  @IsString()
  goal: string;

  @ApiPropertyOptional({ example: '30 days' })
  @IsOptional()
  @IsString()
  timeline?: string;

  @ApiPropertyOptional({ type: [String], example: ['Instagram', 'TikTok', 'Facebook'] })
  @IsOptional()
  @IsArray()
  channels?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetAudience?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  productIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  additionalContext?: string;
}
