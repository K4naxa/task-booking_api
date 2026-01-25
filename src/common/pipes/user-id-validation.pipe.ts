import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { isAlphanumeric, isNotEmpty } from 'class-validator';
@Injectable()
export class UserIdValidationPipe implements PipeTransform {
  transform(value: unknown): string {
    if (!isNotEmpty(value)) {
      throw new BadRequestException('userId is required');
    }
    if (typeof value !== 'string') {
      throw new BadRequestException('userId must be a string');
    }
    if (!isAlphanumeric(value, 'en-US')) {
      throw new BadRequestException(
        'userId must contain only alphanumeric characters',
      );
    }
    return value;
  }
}
