import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsArray, IsBoolean, MaxLength } from 'class-validator';

export class UpdateBrandDto {
  @ApiPropertyOptional({ example: 'Acme Corp' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  brandName?: string;

  @ApiPropertyOptional({ example: 'technology' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ example: 'casual' })
  @IsOptional()
  @IsString()
  tone?: string;

  @ApiPropertyOptional({ example: ['witty', 'concise', 'inspiring'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  voiceCharacteristics?: string[];

  @ApiPropertyOptional({ example: ['competitor', 'lawsuit'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  prohibitedWords?: string[];

  @ApiPropertyOptional({ example: ['#techlife', '#innovation'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredHashtags?: string[];

  @ApiPropertyOptional({ example: ['product updates', 'industry tips', 'customer stories'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contentPillars?: string[];

  @ApiPropertyOptional({ example: 'Our brand is innovative and customer-first...' })
  @IsOptional()
  @IsString()
  brandDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoReplyEnabled?: boolean;
}
