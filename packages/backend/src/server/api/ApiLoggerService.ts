import { Injectable } from '@nestjs/common';
import Logger from '@/misc/logger.js';

@Injectable()
export class ApiLoggerService {
	public logger = new Logger('api');
}
