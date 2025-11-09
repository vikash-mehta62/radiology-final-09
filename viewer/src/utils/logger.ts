/**
 * Logger utility for the medical imaging viewer
 */

export interface Logger {
  debug: (message: string, ...args: any[]) => void
  info: (message: string, ...args: any[]) => void
  warn: (message: string, ...args: any[]) => void
  error: (message: string, ...args: any[]) => void
}

class ConsoleLogger implements Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'

  debug(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.debug(`[DEBUG] ${message}`, ...args)
    }
  }

  info(message: string, ...args: any[]): void {
    console.info(`[INFO] ${message}`, ...args)
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[WARN] ${message}`, ...args)
  }

  error(message: string, ...args: any[]): void {
    console.error(`[ERROR] ${message}`, ...args)
  }
}

export const logger = new ConsoleLogger()

export default logger