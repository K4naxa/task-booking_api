import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { BookingStatus } from '@prisma/client';

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  async create(createBookingDto: CreateBookingDto) {
    const { userId, roomId, startTime, endTime } = createBookingDto;

    // Validate time format and granularity
    const start = new Date(startTime);
    const end = new Date(endTime);

    this.validateTimeGranularity(start, 'startTime');
    this.validateTimeGranularity(end, 'endTime');

    // Validate startTime is in the future
    const now = new Date();
    if (start <= now) {
      throw new BadRequestException('startTime must be in the future');
    }

    // Validate startTime is before endTime
    if (start >= end) {
      throw new BadRequestException('startTime must be before endTime');
    }

    // Check if room exists
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new NotFoundException(`Room with id ${roomId} not found`);
    }

    // Check for overlapping CONFIRMED bookings
    const overlappingBooking = await this.prisma.booking.findFirst({
      where: {
        roomId,
        status: BookingStatus.CONFIRMED,
        OR: [
          {
            // New booking starts during existing booking
            AND: [{ startTime: { lte: start } }, { endTime: { gt: start } }],
          },
          {
            // New booking ends during existing booking
            AND: [{ startTime: { lt: end } }, { endTime: { gte: end } }],
          },
          {
            // New booking encompasses existing booking
            AND: [{ startTime: { gte: start } }, { endTime: { lte: end } }],
          },
        ],
      },
    });

    if (overlappingBooking) {
      throw new ConflictException('Time slot conflicts with existing booking');
    }

    // Create the booking
    const booking = await this.prisma.booking.create({
      data: {
        userId,
        roomId,
        startTime: start,
        endTime: end,
        status: BookingStatus.CONFIRMED,
      },
      include: {
        room: true,
      },
    });

    return booking;
  }

  async cancel(id: number, cancelBookingDto: CancelBookingDto) {
    const { userId } = cancelBookingDto;

    // Find booking by both id and userId
    const booking = await this.prisma.booking.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        room: true,
      },
    });

    // If not found, return 404
    if (!booking) {
      throw new NotFoundException(`Booking with id ${id} not found`);
    }

    // Check if already cancelled
    if (booking.status === BookingStatus.CANCELLED) {
      throw new ConflictException('Booking is already cancelled');
    }

    // Check if booking is in the past
    const now = new Date();
    if (booking.startTime <= now) {
      throw new BadRequestException(
        'Cannot cancel a booking that has already started or is in the past',
      );
    }

    // Update booking to cancelled
    const updatedBooking = await this.prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
      },
      include: {
        room: true,
      },
    });

    return updatedBooking;
  }

  async findByUser(userId: string) {
    // Validate userId format
    if (!/^[a-zA-Z0-9]+$/.test(userId)) {
      throw new BadRequestException(
        'userId must contain only alphanumeric characters',
      );
    }

    const bookings = await this.prisma.booking.findMany({
      where: { userId },
      include: { room: true },
      orderBy: { startTime: 'asc' },
    });

    return bookings;
  }

  async findByRoom(roomId: number, status?: BookingStatus) {
    // Check if room exists
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new NotFoundException(`Room with id ${roomId} not found`);
    }

    const bookings = await this.prisma.booking.findMany({
      where: {
        roomId,
        ...(status && { status }),
      },
      include: { room: true },
      orderBy: { startTime: 'asc' },
    });

    return bookings;
  }

  private validateTimeGranularity(date: Date, fieldName: string) {
    const minutes = date.getUTCMinutes();
    const seconds = date.getUTCSeconds();
    const milliseconds = date.getUTCMilliseconds();

    if (minutes % 10 !== 0 || seconds !== 0 || milliseconds !== 0) {
      throw new BadRequestException(
        `${fieldName} must align to 10-minute intervals (e.g., :00, :10, :20, :30, :40, :50) with no seconds or milliseconds`,
      );
    }
  }
}
