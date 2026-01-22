import { Test, TestingModule } from '@nestjs/testing';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { PrismaService } from '../prisma.service';
import { INestApplication } from '@nestjs/common';

describe('RoomsController', () => {
  let app: INestApplication;
  let controller: RoomsController;
  let prismaService: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoomsController],
      providers: [RoomsService, PrismaService],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    controller = module.get<RoomsController>(RoomsController);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /rooms', () => {
    it('should return an array of rooms', async () => {
      const result = await controller.findAll();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(10);
    });

    it('should return rooms with correct structure', async () => {
      const result = await controller.findAll();

      const firstRoom = result[0];
      expect(firstRoom).toHaveProperty('id');
      expect(firstRoom).toHaveProperty('name');
      expect(typeof firstRoom.id).toBe('number');
      expect(typeof firstRoom.name).toBe('string');
    });

    it('should return rooms in correct order with correct names', async () => {
      const result = await controller.findAll();

      expect(result[0].id).toBe(1);
      expect(result[0].name).toBe('Room 1');
      expect(result[9].id).toBe(10);
      expect(result[9].name).toBe('Room 10');
    });
  });
});
