import { Injectable } from '@nestjs/common';
import Logger from '@/misc/logger.js';

@Injectable()
export class RemoteLoggerService {
	public logger = new Logger('remote', 'cyan');
}
