import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class BookingValidationService {
  /**
   * Validates booking times according to business rules:
   * - Times must align to 10-minute intervals
   * - Start time must be in the future
   * - Start time must be before end time
   *
   * @param startTime ISO8601 formatted start time string
   * @param endTime ISO8601 formatted end time string
   * @returns Object with parsed start and end Date objects
   * @throws BadRequestException if any validation rule is violated
   */
  validateBookingTimes(
    startTime: string,
    endTime: string,
  ): { start: Date; end: Date } {
    const start = new Date(startTime);
    const end = new Date(endTime);

    this.validateTimeGranularity(start, 'startTime');
    this.validateTimeGranularity(end, 'endTime');
    this.validateFutureTime(start);
    this.validateTimeOrder(start, end);

    return { start, end };
  }

  /**
   * Validates that a date aligns to 10-minute intervals
   * with no seconds or milliseconds
   *
   * @param date Date to validate
   * @param fieldName Name of the field for error messages
   * @throws BadRequestException if time doesn't align to 10-minute intervals
   */
  private validateTimeGranularity(date: Date, fieldName: string): void {
    const minutes = date.getUTCMinutes();
    const seconds = date.getUTCSeconds();
    const milliseconds = date.getUTCMilliseconds();

    if (minutes % 10 !== 0 || seconds !== 0 || milliseconds !== 0) {
      throw new BadRequestException(
        `${fieldName} must align to 10-minute intervals (e.g., :00, :10, :20, :30, :40, :50) with no seconds or milliseconds`,
      );
    }
  }

  /**
   * Validates that a date is in the future
   *
   * @param date Date to validate
   * @throws BadRequestException if date is not in the future
   */
  private validateFutureTime(date: Date): void {
    const now = new Date();
    if (date <= now) {
      throw new BadRequestException('startTime must be in the future');
    }
  }

  /**
   * Validates that start time is before end time
   *
   * @param start Start date
   * @param end End date
   * @throws BadRequestException if start is not before end
   */
  private validateTimeOrder(start: Date, end: Date): void {
    if (start >= end) {
      throw new BadRequestException('startTime must be before endTime');
    }
  }
}
