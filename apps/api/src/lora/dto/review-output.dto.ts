import { IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReviewOutputDto {
  @ApiProperty()
  @IsUUID()
  outputId: string;

  @ApiProperty()
  @IsUUID()
  taskId: string;
}

export class RunAgentTaskDto {
  @ApiProperty()
  @IsUUID()
  taskId: string;

  @ApiProperty({ enum: ['Sam', 'Clara', 'Steve', 'Sarah', 'Lora'] })
  @IsString()
  agentName: string;
}

export class ApprovalActionDto {
  @ApiProperty({ required: false })
  notes?: string;
}
