import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Room } from '@prisma/client';

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<Room[]> {
    return this.prisma.room.findMany({
      orderBy: { id: 'asc' },
    });
  }
}
