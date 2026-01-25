import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { MutexModule } from '../mutex/mutex.module';

@Module({
  imports: [MutexModule],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
