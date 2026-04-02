import { format, parseISO, addHours, subHours } from "date-fns";

export class TimeService {
  private static BR_OFFSET = -3;

  /**
   * Returns 'now' in America/Sao_Paulo (UTC -3).
   */
  static getNowLocal(): Date {
    const now = new Date();
    // If server is UTC, we subtract 3 hours to get local
    return addHours(now, this.BR_OFFSET);
  }

  /**
   * Converts a BRT Date or ISO string representing local time to UTC for storage.
   */
  static toUTC(localDate: Date | string): Date {
    const date = typeof localDate === 'string' ? parseISO(localDate) : localDate;
    // To go from BRT (-3) to UTC (0), we ADD 3 hours.
    return addHours(date, Math.abs(this.BR_OFFSET));
  }

  /**
   * Converts a UTC Date or ISO string from DB to a local Date (BRT).
   */
  static toLocal(utcDate: Date | string): Date {
    const date = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
    // To go from UTC (0) to BRT (-3), we SUBTRACT 3 hours.
    return addHours(date, this.BR_OFFSET);
  }

  /**
   * Formats a date for display in HH:mm (America/Sao_Paulo).
   */
  static formatLocalTime(date: Date | string): string {
    const local = this.toLocal(date);
    return format(local, "HH:mm");
  }

  /**
   * Formats a date for display in DD/MM/YYYY (America/Sao_Paulo).
   */
  static formatLocalDate(date: Date | string): string {
    const local = this.toLocal(date);
    return format(local, "dd/MM/yyyy");
  }
}
