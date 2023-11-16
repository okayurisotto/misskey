import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import type { OnApplicationShutdown } from '@nestjs/common';

@Injectable()
export class RedisService extends Redis implements OnApplicationShutdown {
	constructor(configLoaderService: ConfigLoaderService) {
		super(configLoaderService.data.redis);
	}

	public onApplicationShutdown(): void {
		this.disconnect();
	}
}
