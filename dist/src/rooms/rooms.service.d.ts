import { PrismaService } from '../prisma.service';
export declare class RoomsService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<{
        id: number;
        name: string;
    }[]>;
}
