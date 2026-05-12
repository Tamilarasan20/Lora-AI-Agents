import { IsString, IsOptional, IsArray, MinLength, MaxLength } from 'class-validator';

export class LoraChatDto {
  @IsString()
  businessId: string;

  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsArray()
  attachments?: string[];
}
