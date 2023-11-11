import { LoggerService } from '@nestjs/common';
import Logger from '@/logger.js';
import { NODE_ENV } from './env.js';

const logger = new Logger('core', 'cyan');
const nestLogger = logger.createSubLogger('nest', 'green');

export class NestLogger implements LoggerService {
	/**
   * Write a 'log' level log.
   */
	log(message: unknown, ...optionalParams: unknown[]): void {
		const ctx = optionalParams[0];
		nestLogger.info(ctx + ': ' + message);
	}

	/**
   * Write an 'error' level log.
   */
	error(message: unknown, ...optionalParams: unknown[]): void {
		const ctx = optionalParams[0];
		nestLogger.error(ctx + ': ' + message);
	}

	/**
   * Write a 'warn' level log.
   */
	warn(message: unknown, ...optionalParams: unknown[]): void {
		const ctx = optionalParams[0];
		nestLogger.warn(ctx + ': ' + message);
	}

	/**
   * Write a 'debug' level log.
   */
	debug?(message: unknown, ...optionalParams: unknown[]): void {
		if (NODE_ENV === 'production') return;
		const ctx = optionalParams[0];
		nestLogger.debug(ctx + ': ' + message);
	}

	/**
   * Write a 'verbose' level log.
   */
	verbose?(message: unknown, ...optionalParams: unknown[]): void {
		if (NODE_ENV === 'production') return;
		const ctx = optionalParams[0];
		nestLogger.debug(ctx + ': ' + message);
	}
}
