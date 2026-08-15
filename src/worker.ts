import * as dotenv from 'dotenv';

dotenv.config();
import { NestFactory } from '@nestjs/core';
import { MessengerWorkerModule } from './message-worker.module';

async function bootstrap() {
  await NestFactory.createApplicationContext(MessengerWorkerModule);
  console.log('========== QUEUE WORKER STARTED ==========');
}
bootstrap();
