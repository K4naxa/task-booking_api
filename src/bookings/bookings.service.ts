import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MutexService } from '../mutex/mutex.service';
import { BookingValidationService } from './booking-validation.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { BookingStatus } from '@prisma/client';
import { BookingWithRoom } from 'src/common/types/room';

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private mutex: MutexService,
    private bookingValidation: BookingValidationService,
  ) {}

  async create(createBookingDto: CreateBookingDto): Promise<BookingWithRoom> {
    const { userId, roomId, startTime, endTime } = createBookingDto;

    // Validate booking times according to business rules
    const { start, end } = this.bookingValidation.validateBookingTimes(
      startTime,
      endTime,
    );

    try {
      return await this.mutex.executeWithLock(`room:${roomId}`, async () => {
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
                startTime: { lt: end }, // booking starts before requested end
                endTime: { gt: start }, // booking ends after requested start
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
      });
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

  async cancel(
    id: number,
    cancelBookingDto: CancelBookingDto,
  ): Promise<BookingWithRoom> {
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

  async findByUser(userId: string): Promise<BookingWithRoom[]> {
    const bookings = await this.prisma.booking.findMany({
      where: { userId },
      include: { room: true },
      orderBy: { startTime: 'asc' },
    });

    return bookings;
  }

  async findByRoom(
    roomId: number,
    status?: BookingStatus,
  ): Promise<BookingWithRoom[]> {
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
}
