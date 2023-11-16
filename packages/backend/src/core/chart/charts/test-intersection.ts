import { Injectable } from '@nestjs/common';
import { AppLockService } from '@/core/AppLockService.js';
import Logger from '@/misc/logger.js';
import { TypeORMService } from '@/core/TypeORMService.js';
import Chart from '../core.js';
import { name, schema } from './entities/test-intersection.js';
import type { KVs } from '../core.js';

/**
 * For testing
 */
// eslint-disable-next-line import/no-default-export
@Injectable()
export default class TestIntersectionChart extends Chart<typeof schema> {
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

	public async addA(key: string): Promise<void> {
		await this.commit({
			a: [key],
		});
	}

	public async addB(key: string): Promise<void> {
		await this.commit({
			b: [key],
		});
	}
}
