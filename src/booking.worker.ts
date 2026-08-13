import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { BookingWorkerModule } from './booking-worker.module';

async function bootstrap() {
  await NestFactory.createApplicationContext(BookingWorkerModule);
  console.log('✅ Booking worker started');
}

bootstrap();
