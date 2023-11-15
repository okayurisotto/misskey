import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import type {
	OnApplicationBootstrap,
	OnApplicationShutdown,
} from '@nestjs/common';

@Injectable()
export class RedisSubService
	extends Redis
	implements OnApplicationBootstrap, OnApplicationShutdown
{
	constructor(@Inject(DI.config) private readonly config_: Config) {
		super(config_.redisForPubsub);
	}

	public async onApplicationBootstrap(): Promise<void> {
		await this.subscribe(this.config_.host);
	}

	public onApplicationShutdown(): void {
		this.disconnect();
	}
}
