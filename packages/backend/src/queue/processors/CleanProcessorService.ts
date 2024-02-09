import { Injectable } from '@nestjs/common';
import type Logger from '@/misc/logger.js';
import { IdService } from '@/core/IdService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';

@Injectable()
export class CleanProcessorService {
	private readonly logger;

	constructor(
		private readonly queueLoggerService: QueueLoggerService,
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('clean');
	}

	public async process(): Promise<void> {
		this.logger.info('Cleaning...');

		const now = new Date();
		const untilDate7 = new Date(+now - 1000 * 60 * 60 * 24 * 7);
		const untilDate90 = new Date(+now - 1000 * 60 * 60 * 24 * 90);

		await Promise.all([
			this.prismaService.client.user_ip.deleteMany({
				where: { createdAt: { lt: untilDate90 } },
			}),
			this.prismaService.client.mutedNote.deleteMany({
				where: {
					id: { lt: this.idService.genId(untilDate90) },
					reason: 'word',
				},
			}),
			this.prismaService.client.antenna.updateMany({
				where: { isActive: true, lastUsedAt: { lt: untilDate7 } },
				data: { isActive: false },
			}),
			this.prismaService.client.role_assignment.deleteMany({
				where: { expiresAt: { not: null, lt: now } },
			}),
		]);

		this.logger.succ('Cleaned.');
	}
}
