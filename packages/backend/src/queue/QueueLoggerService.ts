import { Injectable } from '@nestjs/common';
import Logger from '@/misc/logger.js';

@Injectable()
export class QueueLoggerService {
	public readonly logger = new Logger('queue', 'orange');
}
