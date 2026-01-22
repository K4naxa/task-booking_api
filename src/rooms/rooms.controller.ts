import { Controller, Get } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { Room } from '@prisma/client';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  findAll(): Promise<Room[]> {
    return this.roomsService.findAll();
  }
}
