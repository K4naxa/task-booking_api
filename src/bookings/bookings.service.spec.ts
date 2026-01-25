import { Test, TestingModule } from '@nestjs/testing';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { MutexService } from '../mutex/mutex.service';
import { BookingValidationService } from './booking-validation.service';

describe('BookingsService - Business Rules & Validations', () => {
  let service: BookingsService;
  let prismaService: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        PrismaService,
        MutexService,
        BookingValidationService,
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    // Clean up bookings before each test
    await prismaService.booking.deleteMany({});
  });

  afterAll(async () => {
    await prismaService.$disconnect();
  });

  describe('Time Granularity Rules (10-minute intervals)', () => {
    let roomId: number;

    beforeEach(async () => {
      const room = await prismaService.room.findFirst();
      if (!room) {
        throw new Error('No room found for testing');
      }
      roomId = room.id;
    });

    it('should accept valid 10-minute aligned times (:00, :10, :20, :30, :40, :50)', async () => {
      const validMinutes = [0, 10, 20, 30, 40, 50];

      for (const minute of validMinutes) {
        const startTime = new Date();
        startTime.setUTCHours(startTime.getUTCHours() + 2, minute, 0, 0);

        const endTime = new Date(startTime);
        endTime.setUTCHours(endTime.getUTCHours() + 1);

        const result = await service.create({
          userId: `user${minute}`,
          roomId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        });

        expect(result.id).toBeDefined();

        // Clean up for next iteration
        await prismaService.booking.deleteMany({});
      }
    });

    it('should reject startTime with invalid minute alignment (not divisible by 10)', async () => {
      const invalidMinutes = [1, 5, 9, 11, 15, 23, 35, 47, 59];

      for (const minute of invalidMinutes) {
        const startTime = new Date();
        startTime.setUTCHours(startTime.getUTCHours() + 2, minute, 0, 0);

        const endTime = new Date(startTime);
        endTime.setUTCHours(endTime.getUTCHours() + 1);

        await expect(
          service.create({
            userId: 'user123',
            roomId,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
          }),
        ).rejects.toThrow(BadRequestException);

        await expect(
          service.create({
            userId: 'user123',
            roomId,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
          }),
        ).rejects.toThrow('startTime must align to 10-minute intervals');
      }
    });

    it('should reject endTime with invalid minute alignment', async () => {
      const startTime = new Date();
      startTime.setUTCHours(startTime.getUTCHours() + 2, 0, 0, 0);

      const endTime = new Date(startTime);
      endTime.setUTCHours(endTime.getUTCHours() + 1, 15, 0, 0); // Invalid: 15 minutes

      await expect(
        service.create({
          userId: 'user123',
          roomId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create({
          userId: 'user123',
          roomId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      ).rejects.toThrow('endTime must align to 10-minute intervals');
    });

    it('should reject times with non-zero seconds', async () => {
      const startTime = new Date();
      startTime.setUTCHours(startTime.getUTCHours() + 2, 0, 30, 0); // 30 seconds

      const endTime = new Date(startTime);
      endTime.setUTCHours(endTime.getUTCHours() + 1, 0, 0, 0);

      await expect(
        service.create({
          userId: 'user123',
          roomId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject times with non-zero milliseconds', async () => {
      const startTime = new Date();
      startTime.setUTCHours(startTime.getUTCHours() + 2, 0, 0, 500); // 500 milliseconds

      const endTime = new Date(startTime);
      endTime.setUTCHours(endTime.getUTCHours() + 1, 0, 0, 0);

      await expect(
        service.create({
          userId: 'user123',
          roomId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Time Ordering Rules', () => {
    let roomId: number;

    beforeEach(async () => {
      const room = await prismaService.room.findFirst();
      if (!room) {
        throw new Error('No room found for testing');
      }
      roomId = room.id;
    });

    it('should reject startTime in the past', async () => {
      const startTime = new Date();
      startTime.setUTCHours(startTime.getUTCHours() - 1, 0, 0, 0); // 1 hour ago

      const endTime = new Date();
      endTime.setUTCHours(endTime.getUTCHours() + 1, 0, 0, 0);

      await expect(
        service.create({
          userId: 'user123',
          roomId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create({
          userId: 'user123',
          roomId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      ).rejects.toThrow('startTime must be in the future');
    });

    it('should reject startTime equal to current time', async () => {
      // Create a time that's very close to now but rounded
      const now = new Date();
      const startTime = new Date();
      startTime.setUTCHours(
        now.getUTCHours(),
        Math.floor(now.getUTCMinutes() / 10) * 10,
        0,
        0,
      );

      const endTime = new Date(startTime);
      endTime.setUTCHours(endTime.getUTCHours() + 1);

      await expect(
        service.create({
          userId: 'user123',
          roomId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when startTime equals endTime', async () => {
      const startTime = new Date();
      startTime.setUTCHours(startTime.getUTCHours() + 2, 0, 0, 0);

      const endTime = new Date(startTime); // Same as startTime

      await expect(
        service.create({
          userId: 'user123',
          roomId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create({
          userId: 'user123',
          roomId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      ).rejects.toThrow('startTime must be before endTime');
    });

    it('should reject when startTime is after endTime', async () => {
      const startTime = new Date();
      startTime.setUTCHours(startTime.getUTCHours() + 3, 0, 0, 0);

      const endTime = new Date();
      endTime.setUTCHours(endTime.getUTCHours() + 2, 0, 0, 0); // Before startTime

      await expect(
        service.create({
          userId: 'user123',
          roomId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.create({
          userId: 'user123',
          roomId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      ).rejects.toThrow('startTime must be before endTime');
    });

    it('should accept valid future times with correct ordering', async () => {
      const startTime = new Date();
      startTime.setUTCHours(startTime.getUTCHours() + 2, 0, 0, 0);

      const endTime = new Date(startTime);
      endTime.setUTCHours(endTime.getUTCHours() + 1);

      const booking = await service.create({
        userId: 'user123',
        roomId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });

      expect(booking.id).toBeDefined();
      expect(booking.status).toBe(BookingStatus.CONFIRMED);
    });
  });

  describe('Overlap Prevention Rules', () => {
    let roomId: number;

    beforeEach(async () => {
      const room = await prismaService.room.findFirst();
      if (!room) {
        throw new Error('No room found for testing');
      }
      roomId = room.id;
    });

    it('should reject exact time overlap with CONFIRMED booking', async () => {
      const startTime = new Date();
      startTime.setUTCHours(startTime.getUTCHours() + 2, 0, 0, 0);

      const endTime = new Date(startTime);
      endTime.setUTCHours(endTime.getUTCHours() + 1);

      // Create first booking
      const first = await service.create({
        userId: 'user1',
        roomId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });

      expect(first.id).toBeDefined();

      // Try to create overlapping booking
      await expect(
        service.create({
          userId: 'user2',
          roomId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.create({
          userId: 'user2',
          roomId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      ).rejects.toThrow('Time slot conflicts with existing booking');
    });

    it('should reject partial overlap at the start', async () => {
      // First booking: 14:00 - 16:00
      const startTime1 = new Date();
      startTime1.setUTCHours(startTime1.getUTCHours() + 2, 0, 0, 0);

      const endTime1 = new Date(startTime1);
      endTime1.setUTCHours(endTime1.getUTCHours() + 2);

      await service.create({
        userId: 'user1',
        roomId,
        startTime: startTime1.toISOString(),
        endTime: endTime1.toISOString(),
      });

      // Second booking: 13:00 - 15:00 (overlaps first hour)
      const startTime2 = new Date(startTime1);
      startTime2.setUTCHours(startTime2.getUTCHours() - 1);

      const endTime2 = new Date(startTime1);
      endTime2.setUTCHours(endTime2.getUTCHours() + 1);

      await expect(
        service.create({
          userId: 'user2',
          roomId,
          startTime: startTime2.toISOString(),
          endTime: endTime2.toISOString(),
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject partial overlap at the end', async () => {
      // First booking: 14:00 - 16:00
      const startTime1 = new Date();
      startTime1.setUTCHours(startTime1.getUTCHours() + 2, 0, 0, 0);

      const endTime1 = new Date(startTime1);
      endTime1.setUTCHours(endTime1.getUTCHours() + 2);

      await service.create({
        userId: 'user1',
        roomId,
        startTime: startTime1.toISOString(),
        endTime: endTime1.toISOString(),
      });

      // Second booking: 15:00 - 17:00 (overlaps second hour)
      const startTime2 = new Date(startTime1);
      startTime2.setUTCHours(startTime2.getUTCHours() + 1);

      const endTime2 = new Date(endTime1);
      endTime2.setUTCHours(endTime2.getUTCHours() + 1);

      await expect(
        service.create({
          userId: 'user2',
          roomId,
          startTime: startTime2.toISOString(),
          endTime: endTime2.toISOString(),
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject booking completely inside existing booking', async () => {
      // First booking: 14:00 - 18:00
      const startTime1 = new Date();
      startTime1.setUTCHours(startTime1.getUTCHours() + 2, 0, 0, 0);

      const endTime1 = new Date(startTime1);
      endTime1.setUTCHours(endTime1.getUTCHours() + 4);

      await service.create({
        userId: 'user1',
        roomId,
        startTime: startTime1.toISOString(),
        endTime: endTime1.toISOString(),
      });

      // Second booking: 15:00 - 16:00 (completely inside)
      const startTime2 = new Date(startTime1);
      startTime2.setUTCHours(startTime2.getUTCHours() + 1);

      const endTime2 = new Date(startTime2);
      endTime2.setUTCHours(endTime2.getUTCHours() + 1);

      await expect(
        service.create({
          userId: 'user2',
          roomId,
          startTime: startTime2.toISOString(),
          endTime: endTime2.toISOString(),
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject booking that completely encompasses existing booking', async () => {
      // First booking: 15:00 - 16:00
      const startTime1 = new Date();
      startTime1.setUTCHours(startTime1.getUTCHours() + 2, 0, 0, 0);

      const endTime1 = new Date(startTime1);
      endTime1.setUTCHours(endTime1.getUTCHours() + 1);

      await service.create({
        userId: 'user1',
        roomId,
        startTime: startTime1.toISOString(),
        endTime: endTime1.toISOString(),
      });

      // Second booking: 14:00 - 18:00 (encompasses first)
      const startTime2 = new Date(startTime1);
      startTime2.setUTCHours(startTime2.getUTCHours() - 1);

      const endTime2 = new Date(endTime1);
      endTime2.setUTCHours(endTime2.getUTCHours() + 2);

      await expect(
        service.create({
          userId: 'user2',
          roomId,
          startTime: startTime2.toISOString(),
          endTime: endTime2.toISOString(),
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow back-to-back bookings (no gap between)', async () => {
      // First booking: 14:00 - 15:00
      const startTime1 = new Date();
      startTime1.setUTCHours(startTime1.getUTCHours() + 2, 0, 0, 0);

      const endTime1 = new Date(startTime1);
      endTime1.setUTCHours(endTime1.getUTCHours() + 1);

      const first = await service.create({
        userId: 'user1',
        roomId,
        startTime: startTime1.toISOString(),
        endTime: endTime1.toISOString(),
      });

      expect(first.id).toBeDefined();

      // Second booking: 15:00 - 16:00 (starts when first ends)
      const startTime2 = new Date(endTime1); // Starts exactly when first ends
      const endTime2 = new Date(startTime2);
      endTime2.setUTCHours(endTime2.getUTCHours() + 1);

      const second = await service.create({
        userId: 'user2',
        roomId,
        startTime: startTime2.toISOString(),
        endTime: endTime2.toISOString(),
      });

      expect(second.id).toBeDefined();
    });

    it('should allow overlapping bookings in different rooms', async () => {
      const rooms = await prismaService.room.findMany({ take: 2 });
      expect(rooms.length).toBeGreaterThanOrEqual(2);

      const startTime = new Date();
      startTime.setUTCHours(startTime.getUTCHours() + 2, 0, 0, 0);

      const endTime = new Date(startTime);
      endTime.setUTCHours(endTime.getUTCHours() + 1);

      // Same time slot, different rooms
      const booking1 = await service.create({
        userId: 'user1',
        roomId: rooms[0].id,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });

      const booking2 = await service.create({
        userId: 'user2',
        roomId: rooms[1].id,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });

      expect(booking1.id).toBeDefined();
      expect(booking2.id).toBeDefined();
    });

    it('should allow booking after cancelling overlapping CANCELLED booking', async () => {
      // Create and cancel first booking
      const startTime = new Date();
      startTime.setUTCHours(startTime.getUTCHours() + 2, 0, 0, 0);

      const endTime = new Date(startTime);
      endTime.setUTCHours(endTime.getUTCHours() + 1);

      const first = await service.create({
        userId: 'user1',
        roomId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });

      // Cancel the booking
      await service.cancel(first.id, { userId: 'user1' });

      // Should be able to book the same slot now
      const second = await service.create({
        userId: 'user2',
        roomId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });

      expect(second.id).toBeDefined();
      expect(second.status).toBe(BookingStatus.CONFIRMED);
    });
  });

  describe('Cancellation Rules', () => {
    let roomId: number;

    beforeEach(async () => {
      const room = await prismaService.room.findFirst();
      if (!room) {
        throw new Error('No room found for testing');
      }
      roomId = room.id;
    });

    it('should successfully cancel a CONFIRMED booking', async () => {
      const startTime = new Date();
      startTime.setUTCHours(startTime.getUTCHours() + 2, 0, 0, 0);

      const endTime = new Date(startTime);
      endTime.setUTCHours(endTime.getUTCHours() + 1);

      const booking = await service.create({
        userId: 'user123',
        roomId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });

      const cancelled = await service.cancel(booking.id, { userId: 'user123' });

      expect(cancelled.status).toBe(BookingStatus.CANCELLED);
      expect(cancelled.cancelledAt).toBeDefined();
      expect(cancelled.cancelledAt).toBeInstanceOf(Date);
    });

    it('should reject cancelling already CANCELLED booking', async () => {
      const startTime = new Date();
      startTime.setUTCHours(startTime.getUTCHours() + 2, 0, 0, 0);

      const endTime = new Date(startTime);
      endTime.setUTCHours(endTime.getUTCHours() + 1);

      const booking = await service.create({
        userId: 'user123',
        roomId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });

      // Cancel once
      await service.cancel(booking.id, { userId: 'user123' });

      // Try to cancel again
      await expect(
        service.cancel(booking.id, { userId: 'user123' }),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.cancel(booking.id, { userId: 'user123' }),
      ).rejects.toThrow('Booking is already cancelled');
    });

    it('should reject cancelling with wrong userId', async () => {
      const startTime = new Date();
      startTime.setUTCHours(startTime.getUTCHours() + 2, 0, 0, 0);

      const endTime = new Date(startTime);
      endTime.setUTCHours(endTime.getUTCHours() + 1);

      const booking = await service.create({
        userId: 'user123',
        roomId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });

      // Try to cancel with different userId
      await expect(
        service.cancel(booking.id, { userId: 'differentUser' }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.cancel(booking.id, { userId: 'differentUser' }),
      ).rejects.toThrow(`Booking with id ${booking.id} not found`);
    });

    it('should reject cancelling non-existent booking', async () => {
      const nonExistentId = 999999;

      await expect(
        service.cancel(nonExistentId, { userId: 'user123' }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.cancel(nonExistentId, { userId: 'user123' }),
      ).rejects.toThrow(`Booking with id ${nonExistentId} not found`);
    });

    it('should reject cancelling booking that has already started', async () => {
      // Create a booking that starts in 2 hours
      const startTime = new Date();
      startTime.setUTCHours(startTime.getUTCHours() + 2, 0, 0, 0);

      const endTime = new Date(startTime);
      endTime.setUTCHours(endTime.getUTCHours() + 1);

      const booking = await service.create({
        userId: 'user123',
        roomId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });

      // Manually update the booking to have a start time in the past
      await prismaService.booking.update({
        where: { id: booking.id },
        data: {
          startTime: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        },
      });

      await expect(
        service.cancel(booking.id, { userId: 'user123' }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.cancel(booking.id, { userId: 'user123' }),
      ).rejects.toThrow(
        'Cannot cancel a booking that has already started or is in the past',
      );
    });
  });

  describe('Room Validation', () => {
    it('should reject booking for non-existent room', async () => {
      const nonExistentRoomId = 999999;

      const startTime = new Date();
      startTime.setUTCHours(startTime.getUTCHours() + 2, 0, 0, 0);

      const endTime = new Date(startTime);
      endTime.setUTCHours(endTime.getUTCHours() + 1);

      await expect(
        service.create({
          userId: 'user123',
          roomId: nonExistentRoomId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.create({
          userId: 'user123',
          roomId: nonExistentRoomId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      ).rejects.toThrow(`Room with id ${nonExistentRoomId} not found`);
    });

    it('should reject finding bookings for non-existent room', async () => {
      const nonExistentRoomId = 999999;

      await expect(service.findByRoom(nonExistentRoomId)).rejects.toThrow(
        NotFoundException,
      );

      await expect(service.findByRoom(nonExistentRoomId)).rejects.toThrow(
        `Room with id ${nonExistentRoomId} not found`,
      );
    });
  });

  describe('UTC ISO 8601 Format', () => {
    let roomId: number;

    beforeEach(async () => {
      const room = await prismaService.room.findFirst();
      if (!room) {
        throw new Error('No room found for testing');
      }
      roomId = room.id;
    });

    it('should store and return times in UTC ISO 8601 format', async () => {
      const startTime = new Date();
      startTime.setUTCHours(startTime.getUTCHours() + 2, 0, 0, 0);

      const endTime = new Date(startTime);
      endTime.setUTCHours(endTime.getUTCHours() + 1);

      const booking = await service.create({
        userId: 'user123',
        roomId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });

      expect(booking.startTime).toBeInstanceOf(Date);
      expect(booking.endTime).toBeInstanceOf(Date);

      // Verify times match what we sent
      expect(booking.startTime.toISOString()).toBe(startTime.toISOString());
      expect(booking.endTime.toISOString()).toBe(endTime.toISOString());
    });
  });

  describe('Query Operations', () => {
    let roomId: number;

    beforeEach(async () => {
      const room = await prismaService.room.findFirst();
      if (!room) {
        throw new Error('No room found for testing');
      }
      roomId = room.id;
    });

    it('should find all bookings for a user', async () => {
      const userId = 'testUser123';

      // Create multiple bookings for the user
      for (let i = 0; i < 3; i++) {
        const startTime = new Date();
        startTime.setUTCHours(startTime.getUTCHours() + 2 + i * 2, 0, 0, 0);

        const endTime = new Date(startTime);
        endTime.setUTCHours(endTime.getUTCHours() + 1);

        await service.create({
          userId,
          roomId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        });
      }

      const bookings = await service.findByUser(userId);
      expect(bookings.length).toBe(3);
      expect(bookings.every((b) => b.userId === userId)).toBe(true);
      expect(bookings.every((b) => b.room)).toBeDefined();
    });

    it('should find all CONFIRMED bookings for a room', async () => {
      // Create 2 confirmed bookings
      for (let i = 0; i < 2; i++) {
        const startTime = new Date();
        startTime.setUTCHours(startTime.getUTCHours() + 2 + i * 2, 0, 0, 0);

        const endTime = new Date(startTime);
        endTime.setUTCHours(endTime.getUTCHours() + 1);

        await service.create({
          userId: `user${i}`,
          roomId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        });
      }

      const confirmedBookings = await service.findByRoom(
        roomId,
        BookingStatus.CONFIRMED,
      );
      expect(confirmedBookings.length).toBe(2);
      expect(
        confirmedBookings.every((b) => b.status === BookingStatus.CONFIRMED),
      ).toBe(true);
    });

    it('should find only CANCELLED bookings for a room when filtered', async () => {
      // Create and cancel one booking
      const startTime1 = new Date();
      startTime1.setUTCHours(startTime1.getUTCHours() + 2, 0, 0, 0);

      const endTime1 = new Date(startTime1);
      endTime1.setUTCHours(endTime1.getUTCHours() + 1);

      const booking = await service.create({
        userId: 'user1',
        roomId,
        startTime: startTime1.toISOString(),
        endTime: endTime1.toISOString(),
      });

      await service.cancel(booking.id, { userId: 'user1' });

      // Create another confirmed booking
      const startTime2 = new Date();
      startTime2.setUTCHours(startTime2.getUTCHours() + 4, 0, 0, 0);

      const endTime2 = new Date(startTime2);
      endTime2.setUTCHours(endTime2.getUTCHours() + 1);

      await service.create({
        userId: 'user2',
        roomId,
        startTime: startTime2.toISOString(),
        endTime: endTime2.toISOString(),
      });

      const cancelledBookings = await service.findByRoom(
        roomId,
        BookingStatus.CANCELLED,
      );
      expect(cancelledBookings.length).toBe(1);
      expect(cancelledBookings[0].status).toBe(BookingStatus.CANCELLED);
    });
  });
});
