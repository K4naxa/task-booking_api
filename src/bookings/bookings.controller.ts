import {
  Controller,
  Post,
  Body,
  Patch,
  Param,
  ParseIntPipe,
  Get,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { BookingStatus } from '@prisma/client';
import { UserIdValidationPipe } from '../common/pipes/user-id-validation.pipe';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  create(@Body() createBookingDto: CreateBookingDto) {
    return this.bookingsService.create(createBookingDto);
  }

  @Patch(':id/cancel')
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @Body() cancelBookingDto: CancelBookingDto,
  ) {
    return this.bookingsService.cancel(id, cancelBookingDto);
  }

  @Get('user/:userId')
  findByUser(@Param('userId', UserIdValidationPipe) userId: string) {
    return this.bookingsService.findByUser(userId);
  }

  @Get('room/:roomId')
  findByRoom(@Param('roomId', ParseIntPipe) roomId: number) {
    return this.bookingsService.findByRoom(roomId);
  }

  @Get('room/:roomId/cancelled')
  findCancelledByRoom(@Param('roomId', ParseIntPipe) roomId: number) {
    return this.bookingsService.findByRoom(roomId, BookingStatus.CANCELLED);
  }

  @Get('room/:roomId/confirmed')
  findConfirmedByRoom(@Param('roomId', ParseIntPipe) roomId: number) {
    return this.bookingsService.findByRoom(roomId, BookingStatus.CONFIRMED);
  }
}
