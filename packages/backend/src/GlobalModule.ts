import { setTimeout } from 'node:timers/promises';
import { Global, Module } from '@nestjs/common';
import { NODE_ENV } from '@/env.js';
import { DI } from '@/di-symbols.js';
import { loadConfig } from '@/config.js';
import { RedisService } from '@/core/RedisService.js';
import { RedisPubService } from '@/core/RedisPubService.js';
import { RedisSubService } from '@/core/RedisSubService.js';
import { MeiliSearchService } from '@/core/MeiliSearchService.js';
import { TypeORMService as TypeORMService } from '@/core/TypeORMService.js';
import type { Provider, OnApplicationShutdown } from '@nestjs/common';

const $config: Provider = {
	provide: DI.config,
	useValue: loadConfig(),
};

@Global()
@Module({
	imports: [],
	providers: [
		$config,
		TypeORMService,
		MeiliSearchService,
		RedisService,
		RedisPubService,
		RedisSubService,
	],
	exports: [
		$config,
		TypeORMService,
		MeiliSearchService,
		RedisService,
		RedisPubService,
		RedisSubService,
	],
})
export class GlobalModule implements OnApplicationShutdown {
	async onApplicationShutdown(): Promise<void> {
		if (NODE_ENV === 'test') {
			// XXX:
			// Shutting down the existing connections causes errors on Jest as
			// Misskey has asynchronous postgres/redis connections that are not
			// awaited.
			// Let's wait for some random time for them to finish.
			await setTimeout(5000);
		}
	}
}
