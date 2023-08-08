import { Injectable } from '@nestjs/common';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import type { OnApplicationShutdown } from '@nestjs/common';

const interval = 30 * 60 * 1000;

@Injectable()
export class JanitorService implements OnApplicationShutdown {
	private intervalId: NodeJS.Timer;

	constructor(private readonly prismaService: PrismaService) {}

	/**
	 * Clean up database occasionally
	 */
	@bindThis
	public start(): void {
		const tick = async () => {
			await this.prismaService.client.attestation_challenge.deleteMany({
				where: {
					createdAt: { lt: new Date(new Date().getTime() - 5 * 60 * 1000) },
				},
			});
		};

		tick();

		this.intervalId = setInterval(tick, interval);
	}

	@bindThis
	public dispose(): void {
		clearInterval(this.intervalId);
	}

	@bindThis
	public onApplicationShutdown(signal?: string | undefined): void {
		this.dispose();
	}
}
