import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';

@Injectable()
export class UserIdValidationPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (!value) {
      throw new BadRequestException('userId is required');
    }

    if (typeof value !== 'string') {
      throw new BadRequestException('userId must be a string');
    }

    // Validate that userId contains only alphanumeric characters
    const alphanumericRegex = /^[a-zA-Z0-9]+$/;
    if (!alphanumericRegex.test(value)) {
      throw new BadRequestException(
        'userId must contain only alphanumeric characters',
      );
    }

    return value;
  }
}
