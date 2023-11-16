import { Injectable } from '@nestjs/common';
import { loadConfig } from '@/config.js';

@Injectable()
export class ConfigLoaderService {
	public readonly data = loadConfig();
}
