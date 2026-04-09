import { IsString, IsOptional, IsArray, IsBoolean } from 'class-validator';

export class CreateIntentDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  replyText?: string;

  @IsOptional()
  @IsArray()
  images?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}