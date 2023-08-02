import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';

@Injectable()
export class PrismaService implements OnApplicationShutdown {
	public readonly client: PrismaClient;

	constructor(
		@Inject(DI.config)
		private readonly config: Config,
	) {
		this.client = new PrismaClient({
			datasources: {
				db: {
					url: `postgresql://${this.config.db.user}:${this.config.db.pass}@${this.config.db.host}:${this.config.db.port}/${this.config.db.db}?schema=public`,
				},
			},
		});
	}

	async onApplicationShutdown(signal?: string | undefined): Promise<void> {
		await this.client.$disconnect();
	}
}
