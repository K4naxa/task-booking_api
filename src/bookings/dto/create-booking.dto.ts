import { IsInt, IsISO8601 } from 'class-validator';
import { UserIdDto } from '../../common/dto/user-id.dto';

export class CreateBookingDto extends UserIdDto {
  @IsInt()
  roomId: number;

  @IsISO8601()
  startTime: string;

  @IsISO8601()
  endTime: string;
}
