import { Injectable } from '@nestjs/common';
import Logger from '@/misc/logger.js';

@Injectable()
export class ChartLoggerService {
	public readonly logger = new Logger('chart', 'white');
}
