import { IsString, IsOptional, IsIn, MinLength, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  sessionId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message: string;

  @IsOptional()
  @IsIn(['lora', 'clara', 'sarah', 'mark'])
  agent?: string;
}

export class GetHistoryDto {
  @IsString()
  sessionId: string;
}
