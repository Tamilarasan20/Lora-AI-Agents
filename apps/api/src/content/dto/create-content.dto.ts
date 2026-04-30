import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsArray, IsOptional, IsEnum, ArrayMinSize, MaxLength,
} from 'class-validator';

export enum ContentTypeEnum {
  SOCIAL_POST = 'SOCIAL_POST',
  CAROUSEL = 'CAROUSEL',
  STORY = 'STORY',
  REEL = 'REEL',
  VIDEO = 'VIDEO',
  BLOG = 'BLOG',
  THREAD = 'THREAD',
}

export class CreateContentDto {
  @ApiProperty({ enum: ContentTypeEnum })
  @IsEnum(ContentTypeEnum)
  contentType: ContentTypeEnum;

  @ApiProperty({ example: 'Announcing our new product launch!' })
  @IsString()
  @MaxLength(10000)
  caption: string;

  @ApiProperty({ example: ['instagram', 'twitter'] })
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
  cta?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hashtags?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Media asset IDs from MediaModule' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mediaAssetIds?: string[];
}
