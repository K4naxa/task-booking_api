import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UserIdValidationPipe } from '../common/pipes/user-id-validation.pipe';

describe('BookingsController - Concurrent Bookings', () => {
  let app: INestApplication;
  let controller: BookingsController;
  let prismaService: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController],
      providers: [BookingsService, PrismaService],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new UserIdValidationPipe());
    await app.init();

    controller = module.get<BookingsController>(BookingsController);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up bookings before each test
    await prismaService.booking.deleteMany({});
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Concurrent booking requests', () => {
    it('should handle 10 concurrent conflicting bookings - 1 success, 9 conflicts', async () => {
      // Get a room to book
      const rooms = await prismaService.room.findMany({ take: 1 });
      expect(rooms.length).toBeGreaterThan(0);
      const roomId = rooms[0].id;

      // Create booking data for the same time slot
      const startTime = new Date();
      startTime.setHours(startTime.getHours() + 2); // 2 hours from now
      startTime.setMinutes(0, 0, 0); // Round to hour

      const endTime = new Date(startTime);
      endTime.setHours(endTime.getHours() + 1); // 1 hour duration

      const bookingDto: CreateBookingDto = {
        userId: 'user123',
        roomId: roomId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      };

      // Send 10 concurrent booking requests for the exact same time slot
      const promises = Array.from({ length: 10 }, () =>
        controller.create(bookingDto).catch((error) => error),
      );

      const results = await Promise.all(promises);

      // Count successful and failed bookings
      let successCount = 0;
      let conflictCount = 0;

      results.forEach((result) => {
        if (result?.id && result?.roomId) {
          // Success - booking created
          successCount++;
        } else if (
          result?.status === HttpStatus.CONFLICT ||
          result?.response?.statusCode === HttpStatus.CONFLICT
        ) {
          // Conflict error
          conflictCount++;
        } else if (
          result?.message?.includes('conflict') ||
          result?.message?.includes('Booking conflict')
        ) {
          // Conflict error (different format)
          conflictCount++;
        }
      });

      // Verify exactly 1 success and 9 conflicts
      expect(successCount).toBe(1);
      expect(conflictCount).toBe(9);

      // Verify only one booking exists in the database
      const bookingsInDb = await prismaService.booking.findMany({
        where: {
          roomId: roomId,
          startTime: startTime,
        },
      });
      expect(bookingsInDb.length).toBe(1);
    });

    it('should handle concurrent bookings with different time slots successfully', async () => {
      // Get a room to book
      const rooms = await prismaService.room.findMany({ take: 1 });
      const roomId = rooms[0].id;

      const baseTime = new Date();
      baseTime.setHours(baseTime.getHours() + 2);
      baseTime.setMinutes(0, 0, 0);

      // Create 5 non-overlapping booking requests
      const bookingPromises = Array.from({ length: 5 }, (_, index) => {
        const startTime = new Date(baseTime);
        startTime.setHours(startTime.getHours() + index * 2); // Each booking 2 hours apart

        const endTime = new Date(startTime);
        endTime.setHours(endTime.getHours() + 1);

        const dto: CreateBookingDto = {
          userId: `user${index}`,
          roomId: roomId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        };

        return controller.create(dto).catch((error) => error);
      });

      const results = await Promise.all(bookingPromises);

      // All should succeed
      const successCount = results.filter(
        (result) => result?.id && result?.roomId,
      ).length;
      expect(successCount).toBe(5);
    });

    it('should prevent partial overlap conflicts', async () => {
      const rooms = await prismaService.room.findMany({ take: 1 });
      const roomId = rooms[0].id;

      const baseTime = new Date();
      baseTime.setHours(baseTime.getHours() + 2);
      baseTime.setMinutes(0, 0, 0);

      // First booking: 10:00 - 12:00
      const firstBooking: CreateBookingDto = {
        userId: 'user1',
        roomId: roomId,
        startTime: baseTime.toISOString(),
        endTime: new Date(
          baseTime.getTime() + 2 * 60 * 60 * 1000,
        ).toISOString(),
      };

      const first = await controller.create(firstBooking);
      expect(first.id).toBeDefined();

      // Try concurrent overlapping bookings
      // Booking 2: 11:00 - 13:00 (overlaps with first)
      // Booking 3: 09:00 - 11:00 (overlaps with first)
      // Booking 4: 10:30 - 11:30 (fully inside first)
      const overlappingBookings = [
        {
          userId: 'user2',
          roomId: roomId,
          startTime: new Date(
            baseTime.getTime() + 60 * 60 * 1000,
          ).toISOString(), // +1 hour
          endTime: new Date(
            baseTime.getTime() + 3 * 60 * 60 * 1000,
          ).toISOString(), // +3 hours
        },
        {
          userId: 'user3',
          roomId: roomId,
          startTime: new Date(
            baseTime.getTime() - 60 * 60 * 1000,
          ).toISOString(), // -1 hour
          endTime: new Date(baseTime.getTime() + 60 * 60 * 1000).toISOString(), // +1 hour
        },
        {
          userId: 'user4',
          roomId: roomId,
          startTime: new Date(
            baseTime.getTime() + 30 * 60 * 1000,
          ).toISOString(), // +30 min
          endTime: new Date(baseTime.getTime() + 90 * 60 * 1000).toISOString(), // +90 min
        },
      ];

      const promises = overlappingBookings.map((dto) =>
        controller.create(dto).catch((error) => error),
      );

      const results = await Promise.all(promises);

      // All should fail with conflict
      const conflictCount = results.filter(
        (result) =>
          result?.status === HttpStatus.CONFLICT ||
          result?.response?.statusCode === HttpStatus.CONFLICT ||
          result?.message?.includes('conflict'),
      ).length;

      expect(conflictCount).toBe(3);

      // Only the first booking should exist
      const bookingsInDb = await prismaService.booking.count({
        where: { roomId: roomId },
      });
      expect(bookingsInDb).toBe(1);
    });
  });
});
