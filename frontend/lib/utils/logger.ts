/**
 * Logging utility for the application
 * In production, logs can be sent to a service like Sentry, LogRocket, or Datadog
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
    [key: string]: unknown
}

class Logger {
    private isDevelopment = process.env.NODE_ENV === 'development'

    private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
        const timestamp = new Date().toISOString()
        const contextStr = context ? ` ${JSON.stringify(context)}` : ''
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`
    }

    debug(message: string, context?: LogContext): void {
        if (this.isDevelopment) {
            console.debug(this.formatMessage('debug', message, context))
        }
    }

    info(message: string, context?: LogContext): void {
        if (this.isDevelopment) {
            console.info(this.formatMessage('info', message, context))
        }
        // In production, send to logging service
    }

    warn(message: string, context?: LogContext): void {
        console.warn(this.formatMessage('warn', message, context))
        // In production, send to logging service
    }

    error(message: string, error?: Error | unknown, context?: LogContext): void {
        const errorContext = {
            ...context,
            error: error instanceof Error ? {
                message: error.message,
                stack: error.stack,
                name: error.name,
            } : error,
        }
        console.error(this.formatMessage('error', message, errorContext))
        // In production, send to error tracking service (e.g., Sentry)
    }
}

export const logger = new Logger()
