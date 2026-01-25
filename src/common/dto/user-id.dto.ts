import { IsAlphanumeric } from 'class-validator';

export class UserIdDto {
  @IsAlphanumeric('en-US', {
    message: 'userId must contain only alphanumeric characters',
  })
  userId: string;
}
