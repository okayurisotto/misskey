import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/PrismaService.js';
import type { OnApplicationShutdown } from '@nestjs/common';

const INTERVAL = 30 * 60 * 1000;

@Injectable()
export class JanitorService implements OnApplicationShutdown {
	private intervalId: NodeJS.Timer;

	constructor(private readonly prismaService: PrismaService) {}

	private async tick(): Promise<void> {
		await this.prismaService.client.attestationChallenge.deleteMany({
			where: {
				createdAt: { lt: new Date(new Date().getTime() - 5 * 60 * 1000) },
			},
		});
	}

	public async start(): Promise<void> {
		await this.tick();

		this.intervalId = setInterval(async () => {
			await this.tick();
		}, INTERVAL);
	}

	public onApplicationShutdown(): void {
		clearInterval(this.intervalId);
	}
}
