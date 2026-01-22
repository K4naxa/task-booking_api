import { IsString, IsInt, IsDateString, Matches } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9]+$/, {
    message: 'userId must contain only alphanumeric characters',
  })
  userId: string;

  @IsInt()
  roomId: number;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;
}
