import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsDateString, IsOptional, IsInt, Min, Max, IsArray, ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SchedulePostDto {
  @ApiProperty({ description: 'Content ID to schedule' })
  @IsString()
  contentId: string;

  @ApiProperty({ description: 'Platform connection ID' })
  @IsString()
  connectionId: string;

  @ApiProperty({ description: 'Target platform (e.g. instagram)' })
  @IsString()
  platform: string;

  @ApiProperty({ description: 'ISO 8601 publish time', example: '2026-05-05T13:00:00Z' })
  @IsDateString()
  scheduledAt: string;

  @ApiPropertyOptional({ description: 'IANA timezone', default: 'UTC' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ description: 'Job priority 1 (high) to 10 (low)', default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  priority?: number;
}

export class BulkScheduleDto {
  @ApiProperty({ type: [SchedulePostDto] })
  @IsArray()
  @ArrayMinSize(1)
  posts: SchedulePostDto[];
}

export class RescheduleDto {
  @ApiProperty({ example: '2026-05-06T09:00:00Z' })
  @IsDateString()
  scheduledAt: string;
}
