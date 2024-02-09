import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';

@Injectable()
export class PrismaService implements OnApplicationShutdown {
	public readonly client;

	constructor(private readonly configLoaderService: ConfigLoaderService) {
		this.client = new PrismaClient({
			datasources: {
				db: {
					url: `postgresql://${this.configLoaderService.data.db.user}:${this.configLoaderService.data.db.pass}@${this.configLoaderService.data.db.host}:${this.configLoaderService.data.db.port}/${this.configLoaderService.data.db.db}?schema=public`,
				},
			},
		});
	}

	public async onApplicationShutdown(): Promise<void> {
		await this.client.$disconnect();
	}
}
