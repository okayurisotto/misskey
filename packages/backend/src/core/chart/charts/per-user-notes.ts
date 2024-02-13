import { Injectable } from '@nestjs/common';
import { AppLockService } from '@/core/AppLockService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { TypeORMService } from '@/core/TypeORMService.js';
import Chart from '../core.js';
import { ChartLoggerService } from '../ChartLoggerService.js';
import { name, schema } from './entities/per-user-notes.js';
import type { KVs } from '../core.js';
import type { Note, User } from '@prisma/client';

/**
 * ユーザーごとのノートに関するチャート
 */
// eslint-disable-next-line import/no-default-export
@Injectable()
export default class PerUserNotesChart extends Chart<typeof schema> {
	constructor(
		db: TypeORMService,
		appLockService: AppLockService,
		chartLoggerService: ChartLoggerService,

		private readonly prismaService: PrismaService,
	) {
		super(
			db,
			(k) => appLockService.getChartInsertLock(k),
			chartLoggerService.logger,
			name,
			schema,
			true,
		);
	}

	protected async tickMajor(
		group: string,
	): Promise<Partial<KVs<typeof schema>>> {
		const [count] = await Promise.all([
			this.prismaService.client.note.count({ where: { userId: group } }),
		]);

		return {
			total: count,
		};
	}

	protected async tickMinor(): Promise<Partial<KVs<typeof schema>>> {
		return {};
	}

	public update(
		user: { id: User['id'] },
		note: Note,
		isAdditional: boolean,
	): void {
		this.commit(
			{
				total: isAdditional ? 1 : -1,
				inc: isAdditional ? 1 : 0,
				dec: isAdditional ? 0 : 1,
				'diffs.normal':
					note.replyId == null && note.renoteId == null
						? isAdditional
							? 1
							: -1
						: 0,
				'diffs.renote': note.renoteId != null ? (isAdditional ? 1 : -1) : 0,
				'diffs.reply': note.replyId != null ? (isAdditional ? 1 : -1) : 0,
				'diffs.withFile': note.fileIds.length > 0 ? (isAdditional ? 1 : -1) : 0,
			},
			user.id,
		);
	}
}
