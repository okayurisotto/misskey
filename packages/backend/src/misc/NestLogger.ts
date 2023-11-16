import { LoggerService } from '@nestjs/common';
import { NODE_ENV } from '@/env.js';
import Logger from '@/misc/logger.js';

export class NestLogger implements LoggerService {
	private readonly logger = new Logger('nest', 'green');

	/**
	 * Write a 'log' level log.
	 */
	log(message: unknown, ...optionalParams: unknown[]): void {
		const ctx = optionalParams[0];
		this.logger.info(ctx + ': ' + message);
	}

	/**
	 * Write an 'error' level log.
	 */
	error(message: unknown, ...optionalParams: unknown[]): void {
		const ctx = optionalParams[0];
		this.logger.error(ctx + ': ' + message);
	}

	/**
	 * Write a 'warn' level log.
	 */
	warn(message: unknown, ...optionalParams: unknown[]): void {
		const ctx = optionalParams[0];
		this.logger.warn(ctx + ': ' + message);
	}

	/**
	 * Write a 'debug' level log.
	 */
	debug?(message: unknown, ...optionalParams: unknown[]): void {
		if (NODE_ENV === 'production') return;

		const ctx = optionalParams[0];
		this.logger.debug(ctx + ': ' + message);
	}

	/**
	 * Write a 'verbose' level log.
	 */
	verbose?(message: unknown, ...optionalParams: unknown[]): void {
		if (NODE_ENV === 'production') return;

		const ctx = optionalParams[0];
		this.logger.debug(ctx + ': ' + message);
	}
}
