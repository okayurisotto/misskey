import { Injectable } from '@nestjs/common';
import type Logger from '@/misc/logger.js';
import { UserMutingService } from '@/core/UserMutingService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';

@Injectable()
export class CheckExpiredMutingsProcessorService {
	private readonly logger;

	constructor(
		private readonly userMutingService: UserMutingService,
		private readonly queueLoggerService: QueueLoggerService,
		private readonly prismaService: PrismaService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('check-expired-mutings');
	}

	public async process(): Promise<void> {
		this.logger.info('Checking expired mutings...');

		const expired = await this.prismaService.client.userMuting.findMany({
			where: {
				expiresAt: { not: null, lt: new Date() },
			},
		});

		if (expired.length > 0) {
			await this.userMutingService.unmute(expired);
		}

		this.logger.succ('All expired mutings checked.');
	}
}
