import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import { IntentService } from './intent.service';
import { CreateIntentDto } from './dto/create-intent.dto';
import { UpdateIntentDto } from './dto/update-intent.dto';

@Controller('api/v1/intents')
export class IntentController {
  constructor(private readonly intentService: IntentService) {}

  @Post()
  create(@Body() dto: CreateIntentDto) {
    return this.intentService.create(dto);
  }

  @Get()
  findAll() {
    return this.intentService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.intentService.findOne(Number(id));
  }

  @Patch(':id')
  update(@Param('id') id: number, @Body() dto: UpdateIntentDto) {
    return this.intentService.update(Number(id), dto);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.intentService.remove(Number(id));
  }
}