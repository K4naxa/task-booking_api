import { RoomsService } from './rooms.service';
export declare class RoomsController {
    private readonly roomsService;
    constructor(roomsService: RoomsService);
    findAll(): Promise<{
        id: number;
        name: string;
    }[]>;
}
