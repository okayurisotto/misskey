import { Injectable } from '@nestjs/common';
import { AppLockService } from '@/core/AppLockService.js';
import { DriveFileEntityService } from '@/core/entities/DriveFileEntityService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { TypeORMService } from '@/core/TypeORMService.js';
import Chart from '../core.js';
import { ChartLoggerService } from '../ChartLoggerService.js';
import { name, schema } from './entities/per-user-drive.js';
import type { KVs } from '../core.js';
import type { drive_file } from '@prisma/client';

/**
 * ユーザーごとのドライブに関するチャート
 */
@Injectable()
// eslint-disable-next-line import/no-default-export
export default class PerUserDriveChart extends Chart<typeof schema> {
	constructor(
		db: TypeORMService,
		appLockService: AppLockService,
		chartLoggerService: ChartLoggerService,

		private readonly driveFileEntityService: DriveFileEntityService,
		private readonly prismaService: PrismaService,
	) {
		super(db, (k) => appLockService.getChartInsertLock(k), chartLoggerService.logger, name, schema, true);
	}

	protected async tickMajor(group: string): Promise<Partial<KVs<typeof schema>>> {
		const [count, size] = await Promise.all([
			this.prismaService.client.drive_file.count({ where: { userId: group } }),
			this.driveFileEntityService.calcDriveUsageOf(group),
		]);

		return {
			'totalCount': count,
			'totalSize': size,
		};
	}

	protected async tickMinor(): Promise<Partial<KVs<typeof schema>>> {
		return {};
	}

	public async update(file: drive_file, isAdditional: boolean): Promise<void> {
		const fileSizeKb = file.size / 1000;
		await this.commit({
			'totalCount': isAdditional ? 1 : -1,
			'totalSize': isAdditional ? fileSizeKb : -fileSizeKb,
			'incCount': isAdditional ? 1 : 0,
			'incSize': isAdditional ? fileSizeKb : 0,
			'decCount': isAdditional ? 0 : 1,
			'decSize': isAdditional ? 0 : fileSizeKb,
		}, file.userId);
	}
}
