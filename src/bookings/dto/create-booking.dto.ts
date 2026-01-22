import { IsInt, IsDateString } from 'class-validator';
import { UserIdDto } from '../../common/dto/user-id.dto';

export class CreateBookingDto extends UserIdDto {
  @IsInt()
  roomId: number;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;
}
