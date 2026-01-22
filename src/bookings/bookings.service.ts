import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const room = await tx.room.findUnique({ where: { id: roomId } });
          if (!room) {
            throw new NotFoundException(`Room with id ${roomId} not found`);
          }

          const overlappingBooking = await tx.booking.findFirst({
            where: {
              roomId,
              status: BookingStatus.CONFIRMED,
              OR: [
                {
                  AND: [
                    { startTime: { lte: start } },
                    { endTime: { gt: start } },
                  ],
                },
                {
                  AND: [{ startTime: { lt: end } }, { endTime: { gte: end } }],
                },
                {
                  AND: [
                    { startTime: { gte: start } },
                    { endTime: { lte: end } },
                  ],
                },
              ],
            },
          });
          if (overlappingBooking) {
            throw new ConflictException(
              'Time slot conflicts with existing booking',
            );
          }
          return tx.booking.create({
            data: {
              userId,
              roomId,
              startTime: start,
              endTime: end,
              status: BookingStatus.CONFIRMED,
            },
            include: { room: true },
          });
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      if (error.code === 'P2034') {
        throw new ConflictException('Booking conflict detected, please retry');
      }
      throw error;
    }
  }

  async cancel(id: number, cancelBookingDto: CancelBookingDto) {
    const { userId } = cancelBookingDto;

    return await this.prisma.$transaction(async (tx) => {
      // Find booking by both id and userId
      const booking = await tx.booking.findUnique({
        where: {
          id_userId: {
            id,
            userId,
          },
        },
        select: {
          id: true,
          startTime: true,
          status: true,
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

      if (booking.startTime < new Date()) {
        throw new BadRequestException(
          'Cannot cancel a booking that has already started or is in the past',
        );
      }

      // Update booking to cancelled
      return await tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
        },
        include: {
          room: true,
        },
      });
    });
  }

  async findByUser(userId: string) {
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
