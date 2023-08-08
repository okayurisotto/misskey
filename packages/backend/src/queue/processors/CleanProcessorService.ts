import { Injectable } from '@nestjs/common';
import type Logger from '@/logger.js';
import { bindThis } from '@/decorators.js';
import { IdService } from '@/core/IdService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';

@Injectable()
export class CleanProcessorService {
	private readonly logger: Logger;

	constructor(
		private readonly queueLoggerService: QueueLoggerService,
		private readonly idService: IdService,
		private readonly prismaService: PrismaService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('clean');
	}

	@bindThis
	public async process(): Promise<void> {
		this.logger.info('Cleaning...');

		await this.prismaService.client.user_ip.deleteMany({
			where: {
				createdAt: { lt: new Date(Date.now() - (1000 * 60 * 60 * 24 * 90)) },
			},
		});

		await this.prismaService.client.muted_note.deleteMany({
			where: {
				id: { lt: this.idService.genId(new Date(Date.now() - (1000 * 60 * 60 * 24 * 90))) },
				reason: 'word',
			},
		});

		await this.prismaService.client.muted_note.deleteMany({
			where: {
				id: { lt: this.idService.genId(new Date(Date.now() - (1000 * 60 * 60 * 24 * 90))) },
				reason: 'word',
			},
		});

		// 7日以上使われてないアンテナを停止
		await this.prismaService.client.antenna.updateMany({
			where: { lastUsedAt: { lt: new Date(Date.now() - (1000 * 60 * 60 * 24 * 7)) } },
			data: { isActive: false },
		});

		const expiredRoleAssignments = await this.prismaService.client.role_assignment.findMany({
			where: { expiresAt: { not: null, lt: new Date() } },
		});

		if (expiredRoleAssignments.length > 0) {
			await this.prismaService.client.role_assignment.deleteMany({
				where: { id: { in: expiredRoleAssignments.map((x) => x.id) } },
			});
		}

		this.logger.succ('Cleaned.');
	}
}
