import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.room.findMany({
      orderBy: { id: 'asc' },
    });
  }
}
