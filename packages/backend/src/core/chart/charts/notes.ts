import { Injectable } from '@nestjs/common';
import { AppLockService } from '@/core/AppLockService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { TypeORMService } from '@/core/TypeORMService.js';
import Chart from '../core.js';
import { ChartLoggerService } from '../ChartLoggerService.js';
import { name, schema } from './entities/notes.js';
import type { KVs } from '../core.js';
import type { Note } from '@prisma/client';

/**
 * ノートに関するチャート
 */
@Injectable()
// eslint-disable-next-line import/no-default-export
export default class NotesChart extends Chart<typeof schema> {
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
		);
	}

	protected async tickMajor(): Promise<Partial<KVs<typeof schema>>> {
		const [localCount, remoteCount] = await Promise.all([
			this.prismaService.client.note.count({ where: { userHost: null } }),
			this.prismaService.client.note.count({
				where: { userHost: { not: null } },
			}),
		]);

		return {
			'local.total': localCount,
			'remote.total': remoteCount,
		};
	}

	protected async tickMinor(): Promise<Partial<KVs<typeof schema>>> {
		return {};
	}

	public async update(note: Note, isAdditional: boolean): Promise<void> {
		const prefix = note.userHost === null ? 'local' : 'remote';

		await this.commit({
			[`${prefix}.total`]: isAdditional ? 1 : -1,
			[`${prefix}.inc`]: isAdditional ? 1 : 0,
			[`${prefix}.dec`]: isAdditional ? 0 : 1,
			[`${prefix}.diffs.normal`]:
				note.replyId == null && note.renoteId == null
					? isAdditional
						? 1
						: -1
					: 0,
			[`${prefix}.diffs.renote`]:
				note.renoteId != null ? (isAdditional ? 1 : -1) : 0,
			[`${prefix}.diffs.reply`]:
				note.replyId != null ? (isAdditional ? 1 : -1) : 0,
			[`${prefix}.diffs.withFile`]:
				note.fileIds.length > 0 ? (isAdditional ? 1 : -1) : 0,
		});
	}
}
