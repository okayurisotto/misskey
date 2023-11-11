import { Injectable } from '@nestjs/common';
import { NODE_ENV } from '@/env.js';
import type Logger from '@/logger.js';
import { LoggerService } from '@/core/LoggerService.js';

@Injectable()
export class ChartLoggerService {
	public logger: Logger;

	constructor(
		private loggerService: LoggerService,
	) {
		this.logger = this.loggerService.getLogger('chart', 'white');
	}
}
