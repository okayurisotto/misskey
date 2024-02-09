import { setTimeout } from 'node:timers/promises';
import { Global, Module } from '@nestjs/common';
import { NODE_ENV } from '@/env.js';
import { RedisService } from '@/core/RedisService.js';
import { RedisPubService } from '@/core/RedisPubService.js';
import { RedisSubService } from '@/core/RedisSubService.js';
import { MeiliSearchService } from '@/core/MeiliSearchService.js';
import { TypeORMService as TypeORMService } from '@/core/TypeORMService.js';
import { BootManagementService } from '@/boot/BootManagementService.js';
import { CoreModule } from '@/core/CoreModule.js';
import { ConfigLoaderService } from './ConfigLoaderService.js';
import { DaemonModule } from './daemons/DaemonModule.js';
import { ServerModule } from './server/ServerModule.js';
import { QueueProcessorModule } from './queue/QueueProcessorModule.js';
import { ClusterManagementService } from './boot/ClusterManagementService.js';
import { BootMessageService } from './boot/BootMessageService.js';
import type { OnApplicationShutdown } from '@nestjs/common';

@Global()
@Module({
	imports: [CoreModule, ServerModule, DaemonModule, QueueProcessorModule],
	providers: [
		BootManagementService,
		BootMessageService,
		ClusterManagementService,
		ConfigLoaderService,
		TypeORMService,
		MeiliSearchService,
		RedisService,
		RedisPubService,
		RedisSubService,
	],
	exports: [
		BootManagementService,
		BootMessageService,
		ClusterManagementService,
		ConfigLoaderService,
		TypeORMService,
		MeiliSearchService,
		RedisService,
		RedisPubService,
		RedisSubService,
	],
})
export class GlobalModule implements OnApplicationShutdown {
	public async onApplicationShutdown(): Promise<void> {
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
