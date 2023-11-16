import { Injectable } from '@nestjs/common';
import { AppLockService } from '@/core/AppLockService.js';
import Logger from '@/misc/logger.js';
import { TypeORMService } from '@/core/TypeORMService.js';
import Chart from '../core.js';
import { name, schema } from './entities/test-unique.js';
import type { KVs } from '../core.js';

/**
 * For testing
 */
// eslint-disable-next-line import/no-default-export
@Injectable()
export default class TestUniqueChart extends Chart<typeof schema> {
	constructor(
		db: TypeORMService,
		appLockService: AppLockService,
		logger: Logger,
	) {
		super(db, (k) => appLockService.getChartInsertLock(k), logger, name, schema);
	}

	protected async tickMajor(): Promise<Partial<KVs<typeof schema>>> {
		return {};
	}

	protected async tickMinor(): Promise<Partial<KVs<typeof schema>>> {
		return {};
	}

	public async uniqueIncrement(key: string): Promise<void> {
		await this.commit({
			foo: [key],
		});
	}
}
