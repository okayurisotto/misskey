import { Injectable } from '@nestjs/common';
import { AppLockService } from '@/core/AppLockService.js';
import { TypeORMService } from '@/core/TypeORMService.js';
import Chart from '../core.js';
import { ChartLoggerService } from '../ChartLoggerService.js';
import { name, schema } from './entities/per-user-pv.js';
import type { KVs } from '../core.js';
import type { User } from '@prisma/client';

/**
 * ユーザーごとのプロフィール被閲覧数に関するチャート
 */
// eslint-disable-next-line import/no-default-export
@Injectable()
export default class PerUserPvChart extends Chart<typeof schema> {
	constructor(
		db: TypeORMService,
		appLockService: AppLockService,
		chartLoggerService: ChartLoggerService,
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

	protected async tickMajor(): Promise<Partial<KVs<typeof schema>>> {
		return {};
	}

	protected async tickMinor(): Promise<Partial<KVs<typeof schema>>> {
		return {};
	}

	public async commitByUser(
		user: { id: User['id'] },
		key: string,
	): Promise<void> {
		await this.commit(
			{
				'upv.user': [key],
				'pv.user': 1,
			},
			user.id,
		);
	}

	public async commitByVisitor(
		user: { id: User['id'] },
		key: string,
	): Promise<void> {
		await this.commit(
			{
				'upv.visitor': [key],
				'pv.visitor': 1,
			},
			user.id,
		);
	}
}
