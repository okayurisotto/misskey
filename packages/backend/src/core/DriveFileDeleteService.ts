import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { MetaService } from '@/core/MetaService.js';
import DriveChart from '@/core/chart/charts/drive.js';
import PerUserDriveChart from '@/core/chart/charts/per-user-drive.js';
import InstanceChart from '@/core/chart/charts/instance.js';
import { InternalStorageService } from '@/core/InternalStorageService.js';
import { PrismaService } from '@/core/PrismaService.js';
import { ObjectStorageFileDeleteService } from './ObjectStorageFileDeleteService.js';
import type { DriveFile } from '@prisma/client';

@Injectable()
export class DriveFileDeleteService {
	constructor(
		private readonly driveChart: DriveChart,
		private readonly instanceChart: InstanceChart,
		private readonly internalStorageService: InternalStorageService,
		private readonly metaService: MetaService,
		private readonly objectStorageFileDeleteService: ObjectStorageFileDeleteService,
		private readonly perUserDriveChart: PerUserDriveChart,
		private readonly prismaService: PrismaService,
	) {}

	public async delete(file: DriveFile, isExpired = false): Promise<void> {
		if (file.storedInternal) {
			if (file.accessKey === null) throw new Error();
			this.internalStorageService.del(file.accessKey);

			if (file.thumbnailUrl) {
				if (file.thumbnailAccessKey === null) throw new Error();
				this.internalStorageService.del(file.thumbnailAccessKey);
			}

			if (file.webpublicUrl) {
				if (file.webpublicAccessKey === null) throw new Error();
				this.internalStorageService.del(file.webpublicAccessKey);
			}
		} else if (!file.isLink) {
			const deleteFile = async (): Promise<void> => {
				if (file.accessKey === null) throw new Error();
				await this.objectStorageFileDeleteService.delete(file.accessKey);
			};

			const deleteThumbnail = async (): Promise<void> => {
				if (file.thumbnailUrl) {
					if (file.thumbnailAccessKey === null) throw new Error();
					await this.objectStorageFileDeleteService.delete(
						file.thumbnailAccessKey,
					);
				}
			};

			const deleteWebpublic = async (): Promise<void> => {
				if (file.webpublicUrl) {
					if (file.webpublicAccessKey === null) throw new Error();
					await this.objectStorageFileDeleteService.delete(
						file.webpublicAccessKey,
					);
				}
			};

			await Promise.all([deleteFile(), deleteThumbnail(), deleteWebpublic()]);
		}

		// リモートファイル期限切れ削除後は直リンクにする
		if (isExpired && file.userHost !== null && file.uri != null) {
			this.prismaService.client.driveFile.update({
				where: { id: file.id },
				data: {
					isLink: true,
					url: file.uri,
					thumbnailUrl: null,
					webpublicUrl: null,
					storedInternal: false,
					// ローカルプロキシ用
					accessKey: randomUUID(),
					thumbnailAccessKey: 'thumbnail-' + randomUUID(),
					webpublicAccessKey: 'webpublic-' + randomUUID(),
				},
			});
		} else {
			this.prismaService.client.driveFile.delete({ where: { id: file.id } });
		}

		this.driveChart.update(file, false);
		if (file.userHost == null) {
			// ローカルユーザーのみ
			this.perUserDriveChart.update(file, false);
		} else {
			if ((await this.metaService.fetch()).enableChartsForFederatedInstances) {
				this.instanceChart.updateDrive(file, false);
			}
		}
	}
}
