import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import type {
	OnApplicationBootstrap,
	OnApplicationShutdown,
} from '@nestjs/common';

@Injectable()
export class RedisSubService
	extends Redis
	implements OnApplicationBootstrap, OnApplicationShutdown
{
	constructor(private readonly configLoaderService: ConfigLoaderService) {
		super(configLoaderService.data.redisForPubsub);
	}

	public async onApplicationBootstrap(): Promise<void> {
		await this.subscribe(this.configLoaderService.data.host);
	}

	public onApplicationShutdown(): void {
		this.disconnect();
	}
}
