import { Injectable } from '@nestjs/common';
import Logger from '@/logger.js';
import { bindThis } from '@/decorators.js';
import type { KEYWORD } from 'color-convert/conversions.js';

@Injectable()
export class LoggerService {
	@bindThis
	public getLogger(domain: string, color?: KEYWORD | undefined, store?: boolean): Logger {
		return new Logger(domain, color, store);
	}
}
