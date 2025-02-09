import { Injectable } from '@nestjs/common';
import { AppLockService } from '@/core/AppLockService.js';
import Logger from '@/misc/logger.js';
import { TypeORMService } from '@/core/TypeORMService.js';
import Chart from '../core.js';
import { name, schema } from './entities/test-grouped.js';
import type { KVs } from '../core.js';

/**
 * For testing
 */
// eslint-disable-next-line import/no-default-export
@Injectable()
export default class TestGroupedChart extends Chart<typeof schema> {
	private total = {} as Record<string, number>;

	constructor(
		db: TypeORMService,
		appLockService: AppLockService,
		logger: Logger,
	) {
		super(
			db,
			(k) => appLockService.getChartInsertLock(k),
			logger,
			name,
			schema,
			true,
		);
	}

	protected async tickMajor(
		group: string,
	): Promise<Partial<KVs<typeof schema>>> {
		return {
			'foo.total': this.total[group],
		};
	}

	protected async tickMinor(): Promise<Partial<KVs<typeof schema>>> {
		return {};
	}

	public async increment(group: string): Promise<void> {
		if (this.total[group] == null) this.total[group] = 0;

		this.total[group]++;

		await this.commit(
			{
				'foo.total': 1,
				'foo.inc': 1,
			},
			group,
		);
	}
}
