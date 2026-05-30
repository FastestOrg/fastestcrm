import { supabase } from '../integrations/supabase/client';

export type LogLevel = 'info' | 'warn' | 'error';

interface LogOptions {
  details?: string | Record<string, unknown>;
  silent?: boolean;
}

class CentralizedLogger {
  private isDev = import.meta.env.DEV;
  private isLoggingToDb = false; // Prevent recursion if logging fails

  /**
   * Log an error event to the database and console.
   */
  public async error(message: string, options?: LogOptions) {
    if (!options?.silent) {
      console.error(`[ERROR] ${message}`, options?.details || '');
    }
    await this.logToDatabase('error', message, options?.details);
  }

  /**
   * Log a warning event to the database and console.
   */
  public async warn(message: string, options?: LogOptions) {
    if (!options?.silent) {
      console.warn(`[WARN] ${message}`, options?.details || '');
    }
    await this.logToDatabase('warn', message, options?.details);
  }

  /**
   * Log an info event to the database and console.
   */
  public async info(message: string, options?: LogOptions) {
    if (!options?.silent) {
      console.log(`[INFO] ${message}`, options?.details || '');
    }
    // Only log info to database in production or if explicitly requested
    if (!this.isDev) {
      await this.logToDatabase('info', message, options?.details);
    }
  }

  private async logToDatabase(level: LogLevel, message: string, details?: string | Record<string, unknown>) {
    if (this.isLoggingToDb) return; // Prevent infinite loop if supabase logging fails

    this.isLoggingToDb = true;
    try {
      let detailsStr = '';
      if (typeof details === 'string') {
        detailsStr = details;
      } else if (details && typeof details === 'object') {
        try {
          detailsStr = JSON.stringify(details, null, 2);
        } catch (e) {
          detailsStr = '[Unserializable details object]';
        }
      }

      const formattedDetails = `[Level: ${level}] ${detailsStr}`.trim();

      // Perform a non-blocking database insert
      const { error } = await supabase
        .from('debug_logs')
        .insert({
          message,
          details: formattedDetails,
        });

      if (error) {
        console.error('Failed to send log to Supabase:', error);
      }
    } catch (err) {
      console.error('Logger exception during Supabase logging:', err);
    } finally {
      this.isLoggingToDb = false;
    }
  }
}

export const logger = new CentralizedLogger();
