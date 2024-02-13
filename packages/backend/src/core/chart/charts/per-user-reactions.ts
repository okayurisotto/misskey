import { Injectable } from '@nestjs/common';
import { AppLockService } from '@/core/AppLockService.js';
import { TypeORMService } from '@/core/TypeORMService.js';
import { UserEntityUtilService } from '@/core/entities/UserEntityUtilService.js';
import Chart from '../core.js';
import { ChartLoggerService } from '../ChartLoggerService.js';
import { name, schema } from './entities/per-user-reactions.js';
import type { KVs } from '../core.js';
import type { Note, User } from '@prisma/client';

/**
 * ユーザーごとのリアクションに関するチャート
 */
// eslint-disable-next-line import/no-default-export
@Injectable()
export default class PerUserReactionsChart extends Chart<typeof schema> {
	constructor(
		db: TypeORMService,
		appLockService: AppLockService,
		chartLoggerService: ChartLoggerService,

		private readonly userEntityUtilService: UserEntityUtilService,
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
		return {};
	}

	protected async tickMinor(): Promise<Partial<KVs<typeof schema>>> {
		return {};
	}

	public async update(
		user: { id: User['id']; host: User['host'] },
		note: Note,
	): Promise<void> {
		const prefix = this.userEntityUtilService.isLocalUser(user)
			? 'local'
			: 'remote';
		this.commit(
			{
				[`${prefix}.count`]: 1,
			},
			note.userId,
		);
	}
}
