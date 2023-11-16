import { Injectable } from '@nestjs/common';
import { AppLockService } from '@/core/AppLockService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { bindThis } from '@/decorators.js';
import { TypeORMService } from '@/core/TypeORMService.js';
import Chart from '../core.js';
import { ChartLoggerService } from '../ChartLoggerService.js';
import { name, schema } from './entities/per-user-reactions.js';
import type { KVs } from '../core.js';
import type { note, user } from '@prisma/client';

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

		private readonly userEntityService: UserEntityService,
	) {
		super(db, (k) => appLockService.getChartInsertLock(k), chartLoggerService.logger, name, schema, true);
	}

	protected async tickMajor(group: string): Promise<Partial<KVs<typeof schema>>> {
		return {};
	}

	protected async tickMinor(): Promise<Partial<KVs<typeof schema>>> {
		return {};
	}

	@bindThis
	public async update(user: { id: user['id'], host: user['host'] }, note: note): Promise<void> {
		const prefix = this.userEntityService.isLocalUser(user) ? 'local' : 'remote';
		this.commit({
			[`${prefix}.count`]: 1,
		}, note.userId);
	}
}
