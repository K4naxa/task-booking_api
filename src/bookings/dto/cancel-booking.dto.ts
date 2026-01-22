import { IsString, Matches } from 'class-validator';

export class CancelBookingDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9]+$/, {
    message: 'userId must contain only alphanumeric characters',
  })
  userId: string;
}
