import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type Logger from '@/logger.js';
import { bindThis } from '@/decorators.js';
import { deepClone } from '@/misc/clone.js';
import { IdService } from '@/core/IdService.js';
import { isDuplicateKeyValueError } from '@/misc/is-duplicate-key-value-error.js';
import { PrismaService } from '@/core/PrismaService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';

@Injectable()
export class AggregateRetentionProcessorService {
	private readonly logger: Logger;

	constructor(
		private readonly idService: IdService,
		private readonly queueLoggerService: QueueLoggerService,
		private readonly prismaService: PrismaService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('aggregate-retention');
	}

	@bindThis
	public async process(): Promise<void> {
		this.logger.info('Aggregating retention...');

		const now = new Date();
		const dateKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

		// 過去(だいたい)30日分のレコードを取得
		const pastRecords = await this.prismaService.client.retention_aggregation.findMany({
			where: {
				createdAt: { gt: new Date(Date.now() - (1000 * 60 * 60 * 24 * 31)) },
			},
		});

		// 今日登録したユーザーを全て取得
		const targetUsers = await this.prismaService.client.user.findMany({
			where: {
				host: null,
				createdAt: { gt: new Date(Date.now() - (1000 * 60 * 60 * 24)) },
			},
		});
		const targetUserIds = targetUsers.map(u => u.id);

		try {
			await this.prismaService.client.retention_aggregation.create({
				data: {
					id: this.idService.genId(),
					createdAt: now,
					updatedAt: now,
					dateKey,
					userIds: targetUserIds,
					usersCount: targetUserIds.length,
				},
			});
		} catch (err) {
			if (isDuplicateKeyValueError(err)) {
				this.logger.succ('Skip because it has already been processed by another worker.');
				return;
			}
			throw err;
		}

		// 今日活動したユーザーを全て取得
		const activeUsers = await this.prismaService.client.user.findMany({
			where: {
				host: null,
				lastActiveDate: { gt: new Date(Date.now() - (1000 * 60 * 60 * 24)) },
			},
		});
		const activeUsersIds = activeUsers.map(u => u.id);

		for (const record of pastRecords) {
			const retention = record.userIds.filter(id => activeUsersIds.includes(id)).length;

			this.prismaService.client.retention_aggregation.update({
				where: { id: record.id },
				data: {
					updatedAt: now,
					data: {
						...deepClone(z.record(z.string(), z.number()).parse(record.data)),
						[dateKey]: retention,
					},
				},
			});
		}

		this.logger.succ('Retention aggregated.');
	}
}
