import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import type { OnApplicationShutdown } from '@nestjs/common';

@Injectable()
export class RedisPubService extends Redis implements OnApplicationShutdown {
	constructor(@Inject(DI.config) config: Config) {
		super(config.redisForPubsub);
	}

	public onApplicationShutdown(): void {
		this.disconnect();
	}
}
