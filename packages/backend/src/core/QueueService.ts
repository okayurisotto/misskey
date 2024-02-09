import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { IActivity } from '@/core/activitypub/type.js';
import type { webhookEventTypes } from '@/models/entities/Webhook.js';
import type { ExportedAntennaSchema } from '@/models/zod/ExportedAntennaSchema.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import type {
	DbQueue,
	DeliverQueue,
	EndedPollNotificationQueue,
	InboxQueue,
	ObjectStorageQueue,
	RelationshipQueue,
	SystemQueue,
	WebhookDeliverQueue,
} from './QueueModule.js';
import type {
	DbJobData,
	DeliverJobData,
	InboxJobData,
	RelationshipJobData,
	ThinUser,
	WebhookDeliverJobData,
} from '../queue/types.js';
import type httpSignature from '@peertube/http-signature';
import type * as Bull from 'bullmq';
import type { DriveFile, webhook } from '@prisma/client';
import type { z } from 'zod';

@Injectable()
export class QueueService {
	constructor(
		private readonly configLoaderService: ConfigLoaderService,

		@Inject('queue:system')
		public systemQueue: SystemQueue,
		@Inject('queue:endedPollNotification')
		public endedPollNotificationQueue: EndedPollNotificationQueue,
		@Inject('queue:deliver')
		public deliverQueue: DeliverQueue,
		@Inject('queue:inbox')
		public inboxQueue: InboxQueue,
		@Inject('queue:db')
		public dbQueue: DbQueue,
		@Inject('queue:relationship')
		public relationshipQueue: RelationshipQueue,
		@Inject('queue:objectStorage')
		public objectStorageQueue: ObjectStorageQueue,
		@Inject('queue:webhookDeliver')
		public webhookDeliverQueue: WebhookDeliverQueue,
	) {
		this.systemQueue.add(
			'tickCharts',
			{},
			{
				repeat: { pattern: '55 * * * *' },
				removeOnComplete: true,
			},
		);

		this.systemQueue.add(
			'resyncCharts',
			{},
			{
				repeat: { pattern: '0 0 * * *' },
				removeOnComplete: true,
			},
		);

		this.systemQueue.add(
			'cleanCharts',
			{},
			{
				repeat: { pattern: '0 0 * * *' },
				removeOnComplete: true,
			},
		);

		this.systemQueue.add(
			'aggregateRetention',
			{},
			{
				repeat: { pattern: '0 0 * * *' },
				removeOnComplete: true,
			},
		);

		this.systemQueue.add(
			'clean',
			{},
			{
				repeat: { pattern: '0 0 * * *' },
				removeOnComplete: true,
			},
		);

		this.systemQueue.add(
			'checkExpiredMutings',
			{},
			{
				repeat: { pattern: '*/5 * * * *' },
				removeOnComplete: true,
			},
		);
	}

	public deliver(
		user: ThinUser,
		content: IActivity | null,
		to: string | null,
		isSharedInbox: boolean,
	): Promise<Bull.Job<DeliverJobData>> | null {
		if (content == null) return null;
		if (to == null) return null;

		const data: DeliverJobData = {
			user: {
				id: user.id,
			},
			content,
			to,
			isSharedInbox,
		};

		return this.deliverQueue.add(to, data, {
			attempts: this.configLoaderService.data.deliverJobMaxAttempts,
			backoff: {
				type: 'custom',
			},
			removeOnComplete: true,
			removeOnFail: true,
		});
	}

	/**
	 * ApDeliverManager-DeliverManager.execute()からinboxesを突っ込んでaddBulkしたい
	 * @param user `{ id: string; }` この関数ではThinUserに変換しないので前もって変換してください
	 * @param content IActivity | null
	 * @param inboxes `Map<string, boolean>` / key: to (inbox url), value: isSharedInbox (whether it is sharedInbox)
	 * @returns void
	 */
	public async deliverMany(
		user: ThinUser,
		content: IActivity | null,
		inboxes: Map<string, boolean>,
	): Promise<null | void> {
		if (content == null) return null;

		const opts = {
			attempts: this.configLoaderService.data.deliverJobMaxAttempts,
			backoff: {
				type: 'custom',
			},
			removeOnComplete: true,
			removeOnFail: true,
		};

		await this.deliverQueue.addBulk(
			Array.from(inboxes.entries(), (d) => ({
				name: d[0],
				data: {
					user,
					content,
					to: d[0],
					isSharedInbox: d[1],
				} as DeliverJobData,
				opts,
			})),
		);

		return;
	}

	public inbox(
		activity: IActivity,
		signature: httpSignature.IParsedSignature,
	): Promise<Bull.Job<InboxJobData>> {
		const data = {
			activity: activity,
			signature,
		};

		return this.inboxQueue.add('', data, {
			attempts: this.configLoaderService.data.inboxJobMaxAttempts,
			backoff: {
				type: 'custom',
			},
			removeOnComplete: true,
			removeOnFail: true,
		});
	}

	public createDeleteDriveFilesJob(user: ThinUser): Promise<Bull.Job<unknown>> {
		return this.dbQueue.add(
			'deleteDriveFiles',
			{
				user: { id: user.id },
			},
			{
				removeOnComplete: true,
				removeOnFail: true,
			},
		);
	}

	public createExportCustomEmojisJob(
		user: ThinUser,
	): Promise<Bull.Job<unknown>> {
		return this.dbQueue.add(
			'exportCustomEmojis',
			{
				user: { id: user.id },
			},
			{
				removeOnComplete: true,
				removeOnFail: true,
			},
		);
	}

	public createExportNotesJob(user: ThinUser): Promise<Bull.Job<unknown>> {
		return this.dbQueue.add(
			'exportNotes',
			{
				user: { id: user.id },
			},
			{
				removeOnComplete: true,
				removeOnFail: true,
			},
		);
	}

	public createExportFavoritesJob(user: ThinUser): Promise<Bull.Job<unknown>> {
		return this.dbQueue.add(
			'exportFavorites',
			{
				user: { id: user.id },
			},
			{
				removeOnComplete: true,
				removeOnFail: true,
			},
		);
	}

	public createExportFollowingJob(
		user: ThinUser,
		excludeMuting = false,
		excludeInactive = false,
	): Promise<Bull.Job<unknown>> {
		return this.dbQueue.add(
			'exportFollowing',
			{
				user: { id: user.id },
				excludeMuting,
				excludeInactive,
			},
			{
				removeOnComplete: true,
				removeOnFail: true,
			},
		);
	}

	public createExportMuteJob(user: ThinUser): Promise<Bull.Job<unknown>> {
		return this.dbQueue.add(
			'exportMuting',
			{
				user: { id: user.id },
			},
			{
				removeOnComplete: true,
				removeOnFail: true,
			},
		);
	}

	public createExportBlockingJob(user: ThinUser): Promise<Bull.Job<unknown>> {
		return this.dbQueue.add(
			'exportBlocking',
			{
				user: { id: user.id },
			},
			{
				removeOnComplete: true,
				removeOnFail: true,
			},
		);
	}

	public createExportUserListsJob(user: ThinUser): Promise<Bull.Job<unknown>> {
		return this.dbQueue.add(
			'exportUserLists',
			{
				user: { id: user.id },
			},
			{
				removeOnComplete: true,
				removeOnFail: true,
			},
		);
	}

	public createExportAntennasJob(user: ThinUser): Promise<Bull.Job<unknown>> {
		return this.dbQueue.add(
			'exportAntennas',
			{
				user: { id: user.id },
			},
			{
				removeOnComplete: true,
				removeOnFail: true,
			},
		);
	}

	public createImportFollowingJob(
		user: ThinUser,
		fileId: string,
	): Promise<Bull.Job<unknown>> {
		return this.dbQueue.add(
			'importFollowing',
			{
				user: { id: user.id },
				fileId: fileId,
			},
			{
				removeOnComplete: true,
				removeOnFail: true,
			},
		);
	}

	public createImportFollowingToDbJob(
		user: ThinUser,
		targets: string[],
	): Promise<Bull.Job<unknown>[]> {
		const jobs = targets.map((rel) =>
			this.generateToDbJobData('importFollowingToDb', { user, target: rel }),
		);
		return this.dbQueue.addBulk(jobs);
	}

	public createImportMutingJob(
		user: ThinUser,
		fileId: string,
	): Promise<Bull.Job<unknown>> {
		return this.dbQueue.add(
			'importMuting',
			{
				user: { id: user.id },
				fileId: fileId,
			},
			{
				removeOnComplete: true,
				removeOnFail: true,
			},
		);
	}

	public createImportBlockingJob(
		user: ThinUser,
		fileId: string,
	): Promise<Bull.Job<unknown>> {
		return this.dbQueue.add(
			'importBlocking',
			{
				user: { id: user.id },
				fileId: fileId,
			},
			{
				removeOnComplete: true,
				removeOnFail: true,
			},
		);
	}

	public createImportBlockingToDbJob(
		user: ThinUser,
		targets: string[],
	): Promise<Bull.Job<unknown>[]> {
		const jobs = targets.map((rel) =>
			this.generateToDbJobData('importBlockingToDb', { user, target: rel }),
		);
		return this.dbQueue.addBulk(jobs);
	}

	private generateToDbJobData<
		T extends 'importFollowingToDb' | 'importBlockingToDb',
		D extends DbJobData<T>,
	>(
		name: T,
		data: D,
	): {
		name: string;
		data: D;
		opts: Bull.JobsOptions;
	} {
		return {
			name,
			data,
			opts: {
				removeOnComplete: true,
				removeOnFail: true,
			},
		};
	}

	public createImportUserListsJob(
		user: ThinUser,
		fileId: string,
	): Promise<Bull.Job<unknown>> {
		return this.dbQueue.add(
			'importUserLists',
			{
				user: { id: user.id },
				fileId: fileId,
			},
			{
				removeOnComplete: true,
				removeOnFail: true,
			},
		);
	}

	public createImportCustomEmojisJob(
		user: ThinUser,
		fileId: string,
	): Promise<Bull.Job<unknown>> {
		return this.dbQueue.add(
			'importCustomEmojis',
			{
				user: { id: user.id },
				fileId: fileId,
			},
			{
				removeOnComplete: true,
				removeOnFail: true,
			},
		);
	}

	public createImportAntennasJob(
		user: ThinUser,
		antenna: z.infer<typeof ExportedAntennaSchema>[],
	): Promise<Bull.Job<unknown>> {
		return this.dbQueue.add(
			'importAntennas',
			{
				user: { id: user.id },
				antenna,
			},
			{
				removeOnComplete: true,
				removeOnFail: true,
			},
		);
	}

	public createDeleteAccountJob(
		user: ThinUser,
		opts: { soft?: boolean } = {},
	): Promise<Bull.Job<unknown>> {
		return this.dbQueue.add(
			'deleteAccount',
			{
				user: { id: user.id },
				soft: opts.soft,
			},
			{
				removeOnComplete: true,
				removeOnFail: true,
			},
		);
	}

	public createFollowJob(
		followings: {
			from: ThinUser;
			to: ThinUser;
			requestId?: string;
			silent?: boolean;
		}[],
	): Promise<Bull.Job<RelationshipJobData>[]> {
		const jobs = followings.map((rel) =>
			this.generateRelationshipJobData('follow', rel),
		);
		return this.relationshipQueue.addBulk(jobs);
	}

	public createUnfollowJob(
		followings: {
			from: ThinUser;
			to: ThinUser;
			requestId?: string;
		}[],
	): Promise<Bull.Job<RelationshipJobData>[]> {
		const jobs = followings.map((rel) =>
			this.generateRelationshipJobData('unfollow', rel),
		);
		return this.relationshipQueue.addBulk(jobs);
	}

	public createDelayedUnfollowJob(
		followings: {
			from: ThinUser;
			to: ThinUser;
			requestId?: string;
		}[],
		delay: number,
	): Promise<Bull.Job<RelationshipJobData>[]> {
		const jobs = followings.map((rel) =>
			this.generateRelationshipJobData('unfollow', rel, { delay }),
		);
		return this.relationshipQueue.addBulk(jobs);
	}

	public createBlockJob(
		blockings: {
			from: ThinUser;
			to: ThinUser;
			silent?: boolean;
		}[],
	): Promise<Bull.Job<RelationshipJobData>[]> {
		const jobs = blockings.map((rel) =>
			this.generateRelationshipJobData('block', rel),
		);
		return this.relationshipQueue.addBulk(jobs);
	}

	public createUnblockJob(
		blockings: {
			from: ThinUser;
			to: ThinUser;
			silent?: boolean;
		}[],
	): Promise<Bull.Job<RelationshipJobData>[]> {
		const jobs = blockings.map((rel) =>
			this.generateRelationshipJobData('unblock', rel),
		);
		return this.relationshipQueue.addBulk(jobs);
	}

	private generateRelationshipJobData(
		name: 'follow' | 'unfollow' | 'block' | 'unblock',
		data: RelationshipJobData,
		opts: Bull.JobsOptions = {},
	): {
		name: string;
		data: RelationshipJobData;
		opts: Bull.JobsOptions;
	} {
		return {
			name,
			data: {
				from: { id: data.from.id },
				to: { id: data.to.id },
				silent: data.silent,
				requestId: data.requestId,
			},
			opts: {
				removeOnComplete: true,
				removeOnFail: true,
				...opts,
			},
		};
	}

	public createDeleteObjectStorageFileJob(
		key: string,
	): Promise<Bull.Job<unknown>> {
		return this.objectStorageQueue.add(
			'deleteFile',
			{
				key: key,
			},
			{
				removeOnComplete: true,
				removeOnFail: true,
			},
		);
	}

	public createCleanRemoteFilesJob(): Promise<Bull.Job<unknown>> {
		return this.objectStorageQueue.add(
			'cleanRemoteFiles',
			{},
			{
				removeOnComplete: true,
				removeOnFail: true,
			},
		);
	}

	public webhookDeliver(
		webhook: webhook,
		type: (typeof webhookEventTypes)[number],
		content: unknown,
	): Promise<Bull.Job<WebhookDeliverJobData>> {
		const data = {
			type,
			content,
			webhookId: webhook.id,
			userId: webhook.userId,
			to: webhook.url,
			secret: webhook.secret,
			createdAt: Date.now(),
			eventId: randomUUID(),
		};

		return this.webhookDeliverQueue.add(webhook.id, data, {
			attempts: 4,
			backoff: {
				type: 'custom',
			},
			removeOnComplete: true,
			removeOnFail: true,
		});
	}

	public destroy(): void {
		this.deliverQueue.once('cleaned', (jobs, status) => {
			//deliverLogger.succ(`Cleaned ${jobs.length} ${status} jobs`);
		});
		this.deliverQueue.clean(0, 0, 'delayed');

		this.inboxQueue.once('cleaned', (jobs, status) => {
			//inboxLogger.succ(`Cleaned ${jobs.length} ${status} jobs`);
		});
		this.inboxQueue.clean(0, 0, 'delayed');
	}
}
