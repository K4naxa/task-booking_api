import { PrismaService } from '../prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { BookingStatus } from '@prisma/client';
export declare class BookingsService {
    private prisma;
    constructor(prisma: PrismaService);
    create(createBookingDto: CreateBookingDto): Promise<{
        room: {
            id: number;
            name: string;
        };
    } & {
        status: import("@prisma/client").$Enums.BookingStatus;
        id: number;
        userId: string;
        roomId: number;
        startTime: Date;
        endTime: Date;
        cancelledAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    cancel(id: number, cancelBookingDto: CancelBookingDto): Promise<{
        room: {
            id: number;
            name: string;
        };
    } & {
        status: import("@prisma/client").$Enums.BookingStatus;
        id: number;
        userId: string;
        roomId: number;
        startTime: Date;
        endTime: Date;
        cancelledAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findByUser(userId: string): Promise<({
        room: {
            id: number;
            name: string;
        };
    } & {
        status: import("@prisma/client").$Enums.BookingStatus;
        id: number;
        userId: string;
        roomId: number;
        startTime: Date;
        endTime: Date;
        cancelledAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    findByRoom(roomId: number, status?: BookingStatus): Promise<({
        room: {
            id: number;
            name: string;
        };
    } & {
        status: import("@prisma/client").$Enums.BookingStatus;
        id: number;
        userId: string;
        roomId: number;
        startTime: Date;
        endTime: Date;
        cancelledAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    })[]>;
    private validateTimeGranularity;
}
