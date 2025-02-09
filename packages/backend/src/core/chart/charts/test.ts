import { Injectable } from '@nestjs/common';
import { AppLockService } from '@/core/AppLockService.js';
import Logger from '@/misc/logger.js';
import { TypeORMService } from '@/core/TypeORMService.js';
import Chart from '../core.js';
import { name, schema } from './entities/test.js';
import type { KVs } from '../core.js';

/**
 * For testing
 */
// eslint-disable-next-line import/no-default-export
@Injectable()
export default class TestChart extends Chart<typeof schema> {
	public total = 0; // publicにするのはテストのため

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
		);
	}

	protected async tickMajor(): Promise<Partial<KVs<typeof schema>>> {
		return {
			'foo.total': this.total,
		};
	}

	protected async tickMinor(): Promise<Partial<KVs<typeof schema>>> {
		return {};
	}

	public async increment(): Promise<void> {
		this.total++;

		await this.commit({
			'foo.total': 1,
			'foo.inc': 1,
		});
	}

	public async decrement(): Promise<void> {
		this.total--;

		await this.commit({
			'foo.total': -1,
			'foo.dec': 1,
		});
	}
}
