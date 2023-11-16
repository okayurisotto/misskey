import { Injectable } from '@nestjs/common';
import { NODE_ENV } from '@/env.js';
import type Logger from '@/misc/logger.js';
import { LoggerService } from '@/core/LoggerService.js';

@Injectable()
export class ChartLoggerService {
	public logger: Logger;

	constructor(
		private readonly loggerService: LoggerService,
	) {
		this.logger = this.loggerService.getLogger('chart', 'white');
	}
}
