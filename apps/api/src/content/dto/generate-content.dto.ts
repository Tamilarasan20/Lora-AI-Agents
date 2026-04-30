import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsEnum, ArrayMinSize } from 'class-validator';

export enum ContentGoalEnum {
  AWARENESS = 'awareness',
  ENGAGEMENT = 'engagement',
  CONVERSION = 'conversion',
  RETENTION = 'retention',
}

export class GenerateContentDto {
  @ApiProperty({ example: 'Announcing our summer sale with 30% off all products' })
  @IsString()
  topic: string;

  @ApiProperty({ enum: ContentGoalEnum })
  @IsEnum(ContentGoalEnum)
  goal: ContentGoalEnum;

  @ApiProperty({ example: ['instagram', 'twitter', 'linkedin'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  targetPlatforms: string[];

  @ApiPropertyOptional({ example: 'casual' })
  @IsOptional()
  @IsString()
  tone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  additionalContext?: string;
}
