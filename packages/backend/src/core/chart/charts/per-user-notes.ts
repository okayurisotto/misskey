import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { User } from '@/models/entities/User.js';
import type { Note } from '@/models/entities/Note.js';
import { AppLockService } from '@/core/AppLockService.js';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import { PrismaService } from '@/core/PrismaService.js';
import Chart from '../core.js';
import { ChartLoggerService } from '../ChartLoggerService.js';
import { name, schema } from './entities/per-user-notes.js';
import type { KVs } from '../core.js';
import type { note } from '@prisma/client';

/**
 * ユーザーごとのノートに関するチャート
 */
// eslint-disable-next-line import/no-default-export
@Injectable()
export default class PerUserNotesChart extends Chart<typeof schema> {
	constructor(
		@Inject(DI.db)
		private readonly db: DataSource,

		private readonly appLockService: AppLockService,
		private readonly chartLoggerService: ChartLoggerService,
		private readonly prismaService: PrismaService,
	) {
		super(db, (k) => appLockService.getChartInsertLock(k), chartLoggerService.logger, name, schema, true);
	}

	protected async tickMajor(group: string): Promise<Partial<KVs<typeof schema>>> {
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

	@bindThis
	public update(user: { id: User['id'] }, note: note, isAdditional: boolean): void {
		this.commit({
			'total': isAdditional ? 1 : -1,
			'inc': isAdditional ? 1 : 0,
			'dec': isAdditional ? 0 : 1,
			'diffs.normal': note.replyId == null && note.renoteId == null ? (isAdditional ? 1 : -1) : 0,
			'diffs.renote': note.renoteId != null ? (isAdditional ? 1 : -1) : 0,
			'diffs.reply': note.replyId != null ? (isAdditional ? 1 : -1) : 0,
			'diffs.withFile': note.fileIds.length > 0 ? (isAdditional ? 1 : -1) : 0,
		}, user.id);
	}
}
