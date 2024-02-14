import { Injectable } from '@nestjs/common';
import { AppLockService } from '@/core/AppLockService.js';
import { TypeORMService } from '@/core/TypeORMService.js';
import Chart from '../core.js';
import { ChartLoggerService } from '../ChartLoggerService.js';
import { name, schema } from './entities/active-users.js';
import type { KVs } from '../core.js';
import type { User } from '@prisma/client';

const DAY = 1000 * 60 * 60 * 24;
const WEEK = DAY * 7;
const MONTH = DAY * 30;
const YEAR = DAY * 365;

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
		super(
			db,
			(k) => appLockService.getChartInsertLock(k),
			chartLoggerService.logger,
			name,
			schema,
		);
	}

	protected async tickMajor(): Promise<Partial<KVs<typeof schema>>> {
		return {};
	}

	protected async tickMinor(): Promise<Partial<KVs<typeof schema>>> {
		return {};
	}

	public async read(user: {
		id: User['id'];
		host: null;
		createdAt: User['createdAt'];
	}): Promise<void> {
		await this.commit({
			read: [user.id],
			registeredWithinWeek:
				Date.now() - user.createdAt.getTime() < WEEK ? [user.id] : [],
			registeredWithinMonth:
				Date.now() - user.createdAt.getTime() < MONTH ? [user.id] : [],
			registeredWithinYear:
				Date.now() - user.createdAt.getTime() < YEAR ? [user.id] : [],
			registeredOutsideWeek:
				Date.now() - user.createdAt.getTime() > WEEK ? [user.id] : [],
			registeredOutsideMonth:
				Date.now() - user.createdAt.getTime() > MONTH ? [user.id] : [],
			registeredOutsideYear:
				Date.now() - user.createdAt.getTime() > YEAR ? [user.id] : [],
		});
	}

	public async write(user: {
		id: User['id'];
		host: null;
		createdAt: User['createdAt'];
	}): Promise<void> {
		await this.commit({
			write: [user.id],
		});
	}
}
