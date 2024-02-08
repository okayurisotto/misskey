import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import Logger from '@/misc/logger.js';
import type { RemoteUser } from '@/models/entities/User.js';
import { MetaService } from '@/core/MetaService.js';
import { IdService } from '@/core/IdService.js';
import { isDuplicateKeyValueError } from '@/misc/is-duplicate-key-value-error.js';
import { IdentifiableError } from '@/misc/identifiable-error.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import DriveChart from '@/core/chart/charts/drive.js';
import PerUserDriveChart from '@/core/chart/charts/per-user-drive.js';
import InstanceChart from '@/core/chart/charts/instance.js';
import { DriveFileEntityPackService } from '@/core/entities/DriveFileEntityPackService.js';
import { FileInfoService } from '@/core/FileInfoService.js';
import { RoleService } from '@/core/RoleService.js';
import { correctFilename } from '@/misc/correct-filename.js';
import { PrismaService } from '@/core/PrismaService.js';
import { DriveFileSaveService } from './DriveFileSaveService.js';
import { DriveFileDeleteService } from './DriveFileDeleteService.js';
import { DriveFileNameValidationService } from './entities/DriveFileNameValidationService.js';
import { DriveUsageCalcService } from './entities/DriveUsageCalcService.js';
import { UserEntityUtilService } from './entities/UserEntityUtilService.js';
import type { Prisma, DriveFile, DriveFolder, user } from '@prisma/client';

type AddFileArgs = {
	/** User who wish to add file */
	user: { id: user['id']; host: user['host'] } | null;
	/** File path */
	path: string;
	/** Name */
	name?: string | null;
	/** Comment */
	comment?: string | null;
	/** Folder ID */
	folderId?: string | null;
	/** If set to true, forcibly upload the file even if there is a file with the same hash. */
	force?: boolean;
	/** Do not save file to local */
	isLink?: boolean;
	/** URL of source (URLからアップロードされた場合(ローカル/リモート)の元URL) */
	url?: string | null;
	/** URL of source (リモートインスタンスのURLからアップロードされた場合の元URL) */
	uri?: string | null;
	/** Mark file as sensitive */
	sensitive?: boolean | null;
	/** Extension to force */
	ext?: string | null;

	requestIp?: string | null;
	requestHeaders?: Record<string, string> | null;
};

const FilePropertiesSchema = z.object({
	width: z.number().optional(),
	height: z.number().optional(),
	orientation: z.number().optional(),
	avgColor: z.string().optional(),
});

@Injectable()
export class DriveFileAddService {
	private readonly registerLogger: Logger;

	constructor(
		private readonly driveChart: DriveChart,
		private readonly driveFileDeleteService: DriveFileDeleteService,
		private readonly driveFileEntityPackService: DriveFileEntityPackService,
		private readonly driveFileNameValidationService: DriveFileNameValidationService,
		private readonly driveFileSaveService: DriveFileSaveService,
		private readonly driveUsageCalcService: DriveUsageCalcService,
		private readonly fileInfoService: FileInfoService,
		private readonly globalEventService: GlobalEventService,
		private readonly idService: IdService,
		private readonly instanceChart: InstanceChart,
		private readonly metaService: MetaService,
		private readonly perUserDriveChart: PerUserDriveChart,
		private readonly prismaService: PrismaService,
		private readonly roleService: RoleService,
		private readonly userEntityUtilService: UserEntityUtilService,
	) {
		const logger = new Logger('drive', 'blue');
		this.registerLogger = logger.createSubLogger('register', 'yellow');
	}

	// Expire oldest file (without avatar or banner) of remote user
	private async expireOldFile(
		user: RemoteUser,
		driveCapacity: number,
	): Promise<void> {
		const fileList = await this.prismaService.client.driveFile.findMany({
			where: {
				userId: user.id,
				isLink: false,
				AND: [
					...(user.avatarId === null ? [] : [{ id: { not: user.avatarId } }]),
					...(user.bannerId === null ? [] : [{ id: { not: user.bannerId } }]),
				],
			},
			orderBy: { id: 'desc' },
		});

		let acc_usage = 0;
		let index = -1;

		for (const file of fileList) {
			if (acc_usage > driveCapacity) break;

			acc_usage += file.size;
			index++;
		}

		const exceedFileIds = fileList.slice(index).map((file) => file.id);

		for (const fileId of exceedFileIds) {
			const file = await this.prismaService.client.driveFile.findUnique({
				where: { id: fileId },
			});
			if (file == null) continue;
			this.driveFileDeleteService.delete(file, true);
		}
	}

	public async add({
		user,
		path,
		name = null,
		comment = null,
		folderId = null,
		force = false,
		isLink = false,
		url = null,
		uri = null,
		sensitive = null,
		requestIp = null,
		requestHeaders = null,
		ext = null,
	}: AddFileArgs): Promise<DriveFile> {
		let skipNsfwCheck = false;
		const instance = await this.metaService.fetch();
		const userRoleNSFW =
			user && (await this.roleService.getUserPolicies(user.id)).alwaysMarkNsfw;
		if (user == null) {
			skipNsfwCheck = true;
		} else if (userRoleNSFW) {
			skipNsfwCheck = true;
		}
		if (instance.sensitiveMediaDetection === 'none') skipNsfwCheck = true;
		if (
			user &&
			instance.sensitiveMediaDetection === 'local' &&
			this.userEntityUtilService.isRemoteUser(user)
		)
			skipNsfwCheck = true;
		if (
			user &&
			instance.sensitiveMediaDetection === 'remote' &&
			this.userEntityUtilService.isLocalUser(user)
		)
			skipNsfwCheck = true;

		const info = await this.fileInfoService.getFileInfo(path, {
			skipSensitiveDetection: skipNsfwCheck,
			// 感度が高いほどしきい値は低くすることになる
			sensitiveThreshold:
				instance.sensitiveMediaDetectionSensitivity === 'veryHigh'
					? 0.1
					: instance.sensitiveMediaDetectionSensitivity === 'high'
					? 0.3
					: instance.sensitiveMediaDetectionSensitivity === 'low'
					? 0.7
					: instance.sensitiveMediaDetectionSensitivity === 'veryLow'
					? 0.9
					: 0.5,
			sensitiveThresholdForPorn: 0.75,
			enableSensitiveMediaDetectionForVideos:
				instance.enableSensitiveMediaDetectionForVideos,
		});
		this.registerLogger.info(`${JSON.stringify(info)}`);

		// 現状 false positive が多すぎて実用に耐えない
		//if (info.porn && instance.disallowUploadWhenPredictedAsPorn) {
		//	throw new IdentifiableError('282f77bf-5816-4f72-9264-aa14d8261a21', 'Detected as porn.');
		//}

		// detect name
		const detectedName = correctFilename(
			// DriveFile.nameは256文字, validateFileNameは200文字制限であるため、
			// extを付加してデータベースの文字数制限に当たることはまずない
			name && this.driveFileNameValidationService.validate(name)
				? name
				: 'untitled',
			ext ?? info.type.ext,
		);

		if (user && !force) {
			// Check if there is a file with the same hash
			const much = await this.prismaService.client.driveFile.findFirst({
				where: { md5: info.md5, userId: user.id },
			});

			if (much) {
				this.registerLogger.info(`file with same hash is found: ${much.id}`);
				return much;
			}
		}

		this.registerLogger.debug(
			`ADD DRIVE FILE: user ${
				user?.id ?? 'not set'
			}, name ${detectedName}, tmp ${path}`,
		);

		//#region Check drive usage
		if (user && !isLink) {
			const usage = await this.driveUsageCalcService.calcUser(user);
			const isLocalUser = this.userEntityUtilService.isLocalUser(user);

			const policies = await this.roleService.getUserPolicies(user.id);
			const driveCapacity = 1024 * 1024 * policies.driveCapacityMb;
			this.registerLogger.debug('drive capacity override applied');
			this.registerLogger.debug(
				`overrideCap: ${driveCapacity}bytes, usage: ${usage}bytes, u+s: ${
					usage + info.size
				}bytes`,
			);

			// If usage limit exceeded
			if (driveCapacity < usage + info.size) {
				if (isLocalUser) {
					throw new IdentifiableError(
						'c6244ed2-a39a-4e1c-bf93-f0fbd7764fa6',
						'No free space.',
					);
				}
				await this.expireOldFile(
					(await this.prismaService.client.user.findUniqueOrThrow({
						where: { id: user.id },
					})) as RemoteUser,
					driveCapacity - info.size,
				);
			}
		}
		//#endregion

		const fetchFolder = async (): Promise<DriveFolder | null> => {
			if (!folderId) return null;

			const driveFolder =
				await this.prismaService.client.driveFolder.findUnique({
					where: {
						id: folderId,
						userId: user ? user.id : null,
					},
				});
			if (driveFolder === null) throw new Error('folder-not-found');

			return driveFolder;
		};

		const properties: {
			width?: number;
			height?: number;
			orientation?: number;
		} = {};

		if (info.width) {
			properties['width'] = info.width;
			properties['height'] = info.height;
		}
		if (info.orientation != null) {
			properties['orientation'] = info.orientation;
		}

		const profile = user
			? await this.prismaService.client.user_profile.findUnique({
					where: { userId: user.id },
			  })
			: null;

		const folder = await fetchFolder();

		const isSensitive = ((): boolean => {
			if (userRoleNSFW) return true;
			if (info.sensitive) {
				if (instance.setSensitiveFlagAutomatically) return true;
				if (profile?.autoSensitive) return true;
			}

			if (user) {
				if (this.userEntityUtilService.isLocalUser(user)) {
					if (profile === null) throw new Error();
					if (profile.alwaysMarkNsfw) {
						return true;
					} else {
						return sensitive ?? false;
					}
				} else {
					return sensitive ?? false;
				}
			} else {
				return false;
			}
		})();

		let file: Prisma.DriveFileUncheckedCreateInput = {
			id: this.idService.genId(),
			createdAt: new Date(),
			userId: user ? user.id : null,
			userHost: user ? user.host : null,
			folderId: folder !== null ? folder.id : null,
			comment: comment,
			properties: properties,
			blurhash: info.blurhash ?? null,
			isLink: isLink,
			requestIp: requestIp,
			requestHeaders: requestHeaders,
			maybeSensitive: info.sensitive,
			maybePorn: info.porn,
			isSensitive: isSensitive,
		};

		if (url !== null) {
			file.src = url;

			if (isLink) {
				file.url = url;
				// ローカルプロキシ用
				file.accessKey = randomUUID();
				file.thumbnailAccessKey = 'thumbnail-' + randomUUID();
				file.webpublicAccessKey = 'webpublic-' + randomUUID();
			}
		}

		if (uri !== null) {
			file.uri = uri;
		}

		if (isLink) {
			try {
				file.size = 0;
				file.md5 = info.md5;
				file.name = detectedName;
				file.type = info.type.mime;
				file.storedInternal = false;

				const result = await this.prismaService.client.driveFile.create({
					data: {
						...file,
						requestHeaders: file.requestHeaders ?? undefined,
					},
				});
				file = {
					...result,
					properties: FilePropertiesSchema.parse(result.properties),
					requestHeaders: z
						.record(z.string(), z.string())
						.nullable()
						.parse(result.requestHeaders),
				};
			} catch (err) {
				// duplicate key error (when already registered)
				if (isDuplicateKeyValueError(err)) {
					this.registerLogger.info(`already registered ${file.uri}`);

					const result =
						await this.prismaService.client.driveFile.findFirstOrThrow({
							where: {
								uri: file.uri!,
								userId: user ? user.id : null,
							},
						});
					file = {
						...result,
						properties: FilePropertiesSchema.parse(result.properties),
						requestHeaders: z
							.record(z.string(), z.string())
							.nullable()
							.parse(result.requestHeaders),
					};
				} else if (err instanceof Error || typeof err === 'string') {
					this.registerLogger.error(err);
					throw err;
				} else {
					throw err;
				}
			}
		} else {
			file = await this.driveFileSaveService.save(
				file,
				path,
				detectedName,
				info.type.mime,
				info.md5,
				info.size,
			);
		}

		this.registerLogger.succ(`drive file has been created ${file.id}`);

		if (user) {
			await this.driveFileEntityPackService
				.pack(file, { self: true })
				.then((packedFile) => {
					// Publish driveFileCreated event
					this.globalEventService.publishMainStream(
						user.id,
						'driveFileCreated',
						packedFile,
					);
					this.globalEventService.publishDriveStream(
						user.id,
						'fileCreated',
						packedFile,
					);
				});
		}

		await this.driveChart.update(file, true);
		if (file.userHost == null) {
			// ローカルユーザーのみ
			await this.perUserDriveChart.update(file, true);
		} else {
			if ((await this.metaService.fetch()).enableChartsForFederatedInstances) {
				await this.instanceChart.updateDrive(file, true);
			}
		}

		return file;
	}
}
