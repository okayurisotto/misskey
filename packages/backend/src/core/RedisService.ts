import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import type { OnApplicationShutdown } from '@nestjs/common';

@Injectable()
export class RedisService extends Redis implements OnApplicationShutdown {
	constructor(@Inject(DI.config) config: Config) {
		super(config.redis);
	}

	public onApplicationShutdown(): void {
		this.disconnect();
	}
}
