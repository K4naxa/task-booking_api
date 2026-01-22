"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
const client_1 = require("@prisma/client");
let BookingsService = class BookingsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(createBookingDto) {
        const { userId, roomId, startTime, endTime } = createBookingDto;
        const start = new Date(startTime);
        const end = new Date(endTime);
        this.validateTimeGranularity(start, 'startTime');
        this.validateTimeGranularity(end, 'endTime');
        const now = new Date();
        if (start <= now) {
            throw new common_1.BadRequestException('startTime must be in the future');
        }
        if (start >= end) {
            throw new common_1.BadRequestException('startTime must be before endTime');
        }
        const room = await this.prisma.room.findUnique({
            where: { id: roomId },
        });
        if (!room) {
            throw new common_1.NotFoundException(`Room with id ${roomId} not found`);
        }
        const overlappingBooking = await this.prisma.booking.findFirst({
            where: {
                roomId,
                status: client_1.BookingStatus.CONFIRMED,
                OR: [
                    {
                        AND: [{ startTime: { lte: start } }, { endTime: { gt: start } }],
                    },
                    {
                        AND: [{ startTime: { lt: end } }, { endTime: { gte: end } }],
                    },
                    {
                        AND: [{ startTime: { gte: start } }, { endTime: { lte: end } }],
                    },
                ],
            },
        });
        if (overlappingBooking) {
            throw new common_1.ConflictException('Time slot conflicts with existing booking');
        }
        const booking = await this.prisma.booking.create({
            data: {
                userId,
                roomId,
                startTime: start,
                endTime: end,
                status: client_1.BookingStatus.CONFIRMED,
            },
            include: {
                room: true,
            },
        });
        return booking;
    }
    async cancel(id, cancelBookingDto) {
        const { userId } = cancelBookingDto;
        const booking = await this.prisma.booking.findFirst({
            where: {
                id,
                userId,
            },
            include: {
                room: true,
            },
        });
        if (!booking) {
            throw new common_1.NotFoundException(`Booking with id ${id} not found`);
        }
        if (booking.status === client_1.BookingStatus.CANCELLED) {
            throw new common_1.ConflictException('Booking is already cancelled');
        }
        const now = new Date();
        if (booking.startTime <= now) {
            throw new common_1.BadRequestException('Cannot cancel a booking that has already started or is in the past');
        }
        const updatedBooking = await this.prisma.booking.update({
            where: { id },
            data: {
                status: client_1.BookingStatus.CANCELLED,
                cancelledAt: new Date(),
            },
            include: {
                room: true,
            },
        });
        return updatedBooking;
    }
    async findByUser(userId) {
        if (!/^[a-zA-Z0-9]+$/.test(userId)) {
            throw new common_1.BadRequestException('userId must contain only alphanumeric characters');
        }
        const bookings = await this.prisma.booking.findMany({
            where: { userId },
            include: { room: true },
            orderBy: { startTime: 'asc' },
        });
        return bookings;
    }
    async findByRoom(roomId, status) {
        const room = await this.prisma.room.findUnique({
            where: { id: roomId },
        });
        if (!room) {
            throw new common_1.NotFoundException(`Room with id ${roomId} not found`);
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
    validateTimeGranularity(date, fieldName) {
        const minutes = date.getUTCMinutes();
        const seconds = date.getUTCSeconds();
        const milliseconds = date.getUTCMilliseconds();
        if (minutes % 10 !== 0 || seconds !== 0 || milliseconds !== 0) {
            throw new common_1.BadRequestException(`${fieldName} must align to 10-minute intervals (e.g., :00, :10, :20, :30, :40, :50) with no seconds or milliseconds`);
        }
    }
};
exports.BookingsService = BookingsService;
exports.BookingsService = BookingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BookingsService);
//# sourceMappingURL=bookings.service.js.map