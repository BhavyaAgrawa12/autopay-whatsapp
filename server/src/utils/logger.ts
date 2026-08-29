type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogPayload {
  level: LogLevel;
  message: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

class Logger {
  private formatLog(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
    const payload: LogPayload = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(meta ? { meta } : {}),
    };
    return JSON.stringify(payload);
  }

  public info(message: string, meta?: Record<string, unknown>): void {
    console.log(this.formatLog('info', message, meta));
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(this.formatLog('warn', message, meta));
  }

  public error(message: string, meta?: Record<string, unknown>): void {
    console.error(this.formatLog('error', message, meta));
  }

  public debug(message: string, meta?: Record<string, unknown>): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.formatLog('debug', message, meta));
    }
  }
}

export const logger = new Logger();
