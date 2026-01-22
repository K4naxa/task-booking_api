import { Booking, Room } from '@prisma/client';

export type BookingWithRoom = Booking & { room: Room };
