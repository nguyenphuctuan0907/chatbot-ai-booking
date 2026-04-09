import { PartialType } from '@nestjs/mapped-types';
import { CreateIntentDto } from './create-intent.dto';

export class UpdateIntentDto extends PartialType(CreateIntentDto) {}