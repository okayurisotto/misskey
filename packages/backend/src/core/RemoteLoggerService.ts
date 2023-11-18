import { Injectable } from '@nestjs/common';
import type Logger from '@/misc/logger.js';
import { LoggerService } from '@/core/LoggerService.js';

@Injectable()
export class RemoteLoggerService {
	public logger: Logger;

	constructor(private readonly loggerService: LoggerService) {
		this.logger = this.loggerService.getLogger('remote', 'cyan');
	}
}
