import { Injectable } from '@nestjs/common';
import Logger from '@/misc/logger.js';

@Injectable()
export class ClientLoggerService {
	public logger = new Logger('client');
}
