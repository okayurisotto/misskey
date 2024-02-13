import { Injectable } from '@nestjs/common';
import { AppLockService } from '@/core/AppLockService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { TypeORMService } from '@/core/TypeORMService.js';
import { UserEntityUtilService } from '@/core/entities/UserEntityUtilService.js';
import Chart from '../core.js';
import { ChartLoggerService } from '../ChartLoggerService.js';
import { name, schema } from './entities/users.js';
import type { KVs } from '../core.js';
import type { User } from '@prisma/client';

/**
 * ユーザー数に関するチャート
 */
@Injectable()
// eslint-disable-next-line import/no-default-export
export default class UsersChart extends Chart<typeof schema> {
	constructor(
		db: TypeORMService,
		appLockService: AppLockService,
		chartLoggerService: ChartLoggerService,

		private readonly prismaService: PrismaService,
		private readonly userEntityUtilService: UserEntityUtilService,
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
			this.prismaService.client.user.count({ where: { host: null } }),
			this.prismaService.client.user.count({ where: { host: { not: null } } }),
		]);

		return {
			'local.total': localCount,
			'remote.total': remoteCount,
		};
	}

	protected async tickMinor(): Promise<Partial<KVs<typeof schema>>> {
		return {};
	}

	public async update(
		user: { id: User['id']; host: User['host'] },
		isAdditional: boolean,
	): Promise<void> {
		const prefix = this.userEntityUtilService.isLocalUser(user)
			? 'local'
			: 'remote';

		this.commit({
			[`${prefix}.total`]: isAdditional ? 1 : -1,
			[`${prefix}.inc`]: isAdditional ? 1 : 0,
			[`${prefix}.dec`]: isAdditional ? 0 : 1,
		});
	}
}
