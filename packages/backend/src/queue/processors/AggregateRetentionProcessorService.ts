import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library.js';
import { deepClone } from '@/misc/clone.js';
import { IdService } from '@/core/IdService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { QueueLoggerService } from '../QueueLoggerService.js';

@Injectable()
export class AggregateRetentionProcessorService {
	private readonly logger;

	constructor(
		private readonly idService: IdService,
		private readonly queueLoggerService: QueueLoggerService,
		private readonly prismaService: PrismaService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger(
			'aggregate-retention',
		);
	}

	public async process(): Promise<void> {
		this.logger.info('Aggregating retention...');

		const now = new Date();
		const dateKey = [
			now.getFullYear(),
			now.getMonth() + 1,
			now.getDate(),
		].join('-');

		/** 過去31日分のレコード */
		const pastRecords =
			await this.prismaService.client.retentionAggregation.findMany({
				where: {
					createdAt: { gt: new Date(+now - 1000 * 60 * 60 * 24 * 31) },
				},
			});

		const targetUsers = await this.prismaService.client.user.findMany({
			where: {
				host: null,
				createdAt: { gt: new Date(+now - 1000 * 60 * 60 * 24) },
			},
		});
		/** 今日登録したユーザーのID */
		const targetUserIds = targetUsers.map((u) => u.id);

		try {
			await this.prismaService.client.retentionAggregation.create({
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
			if (err instanceof PrismaClientKnownRequestError) {
				if (err.code === 'P2002') {
					this.logger.succ(
						'Skip because it has already been processed by another worker.',
					);
					return;
				}
			}
			throw err;
		}

		const activeUsers = await this.prismaService.client.user.findMany({
			where: {
				host: null,
				lastActiveDate: { gt: new Date(+now - 1000 * 60 * 60 * 24) },
			},
		});
		/** 今日活動したユーザーのID */
		const activeUsersIds = new Set(activeUsers.map((u) => u.id));

		await Promise.all(
			pastRecords.map(async (record) => {
				const retention = record.userIds.filter((id) =>
					activeUsersIds.has(id),
				).length;

				await this.prismaService.client.retentionAggregation.update({
					where: { id: record.id },
					data: {
						updatedAt: now,
						data: {
							...deepClone(z.record(z.string(), z.number()).parse(record.data)),
							[dateKey]: retention,
						},
					},
				});
			}),
		);

		this.logger.succ('Retention aggregated.');
	}
}
