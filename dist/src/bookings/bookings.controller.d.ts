import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
export declare class BookingsController {
    private readonly bookingsService;
    constructor(bookingsService: BookingsService);
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
    findByRoom(roomId: number): Promise<({
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
    findCancelledByRoom(roomId: number): Promise<({
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
    findConfirmedByRoom(roomId: number): Promise<({
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
}
