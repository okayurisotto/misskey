import { Injectable } from '@nestjs/common';
import type Logger from '@/misc/logger.js';
import { RemoteLoggerService } from '@/core/RemoteLoggerService.js';

@Injectable()
export class ApLoggerService {
	public logger: Logger;

	constructor(
		private remoteLoggerService: RemoteLoggerService,
	) {
		this.logger = this.remoteLoggerService.logger.createSubLogger('ap', 'magenta');
	}
}
