import { Injectable } from '@nestjs/common';
import type Logger from '@/logger.js';
import { bindThis } from '@/decorators.js';
import { UserMutingService } from '@/core/UserMutingService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';

@Injectable()
export class CheckExpiredMutingsProcessorService {
	private readonly logger: Logger;

	constructor(
		private readonly userMutingService: UserMutingService,
		private readonly queueLoggerService: QueueLoggerService,
		private readonly prismaService: PrismaService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('check-expired-mutings');
	}

	@bindThis
	public async process(): Promise<void> {
		this.logger.info('Checking expired mutings...');

		const expired = await this.prismaService.client.muting.findMany({
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
