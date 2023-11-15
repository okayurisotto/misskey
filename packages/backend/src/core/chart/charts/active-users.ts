import { Injectable } from '@nestjs/common';
import { AppLockService } from '@/core/AppLockService.js';
import { bindThis } from '@/decorators.js';
import { TypeORMService } from '@/core/TypeORMService.js';
import Chart from '../core.js';
import { ChartLoggerService } from '../ChartLoggerService.js';
import { name, schema } from './entities/active-users.js';
import type { KVs } from '../core.js';
import type { user } from '@prisma/client';

const week = 1000 * 60 * 60 * 24 * 7;
const month = 1000 * 60 * 60 * 24 * 30;
const year = 1000 * 60 * 60 * 24 * 365;

/**
 * アクティブユーザーに関するチャート
 */
// eslint-disable-next-line import/no-default-export
@Injectable()
export default class ActiveUsersChart extends Chart<typeof schema> {
	constructor(
		db: TypeORMService,
		appLockService: AppLockService,
		chartLoggerService: ChartLoggerService,
	) {
		super(db, (k) => appLockService.getChartInsertLock(k), chartLoggerService.logger, name, schema);
	}

	protected async tickMajor(): Promise<Partial<KVs<typeof schema>>> {
		return {};
	}

	protected async tickMinor(): Promise<Partial<KVs<typeof schema>>> {
		return {};
	}

	@bindThis
	public async read(user: { id: user['id'], host: null, createdAt: user['createdAt'] }): Promise<void> {
		await this.commit({
			'read': [user.id],
			'registeredWithinWeek': (Date.now() - user.createdAt.getTime() < week) ? [user.id] : [],
			'registeredWithinMonth': (Date.now() - user.createdAt.getTime() < month) ? [user.id] : [],
			'registeredWithinYear': (Date.now() - user.createdAt.getTime() < year) ? [user.id] : [],
			'registeredOutsideWeek': (Date.now() - user.createdAt.getTime() > week) ? [user.id] : [],
			'registeredOutsideMonth': (Date.now() - user.createdAt.getTime() > month) ? [user.id] : [],
			'registeredOutsideYear': (Date.now() - user.createdAt.getTime() > year) ? [user.id] : [],
		});
	}

	@bindThis
	public async write(user: { id: user['id'], host: null, createdAt: user['createdAt'] }): Promise<void> {
		await this.commit({
			'write': [user.id],
		});
	}
}
