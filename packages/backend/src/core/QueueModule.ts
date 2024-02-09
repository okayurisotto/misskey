import { setTimeout } from 'node:timers/promises';
import { Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import * as Bull from 'bullmq';
import { NODE_ENV } from '@/env.js';
import { Queue, baseQueueOptions } from '@/queue/const.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import type { Provider } from '@nestjs/common';
import type {
	DeliverJobData,
	InboxJobData,
	EndedPollNotificationJobData,
	WebhookDeliverJobData,
	RelationshipJobData,
} from '../queue/types.js';

export type SystemQueue = Bull.Queue<Record<string, unknown>>;
export type EndedPollNotificationQueue =
	Bull.Queue<EndedPollNotificationJobData>;
export type DeliverQueue = Bull.Queue<DeliverJobData>;
export type InboxQueue = Bull.Queue<InboxJobData>;
export type DbQueue = Bull.Queue;
export type RelationshipQueue = Bull.Queue<RelationshipJobData>;
export type ObjectStorageQueue = Bull.Queue;
export type WebhookDeliverQueue = Bull.Queue<WebhookDeliverJobData>;

const $system: Provider = {
	provide: 'queue:system',
	useFactory: (configLoaderService: ConfigLoaderService) =>
		new Bull.Queue(
			Queue.System,
			baseQueueOptions(configLoaderService.data, Queue.System),
		),
	inject: [ConfigLoaderService],
};

const $endedPollNotification: Provider = {
	provide: 'queue:endedPollNotification',
	useFactory: (configLoaderService: ConfigLoaderService) =>
		new Bull.Queue(
			Queue.EndedPollNotification,
			baseQueueOptions(configLoaderService.data, Queue.EndedPollNotification),
		),
	inject: [ConfigLoaderService],
};

const $deliver: Provider = {
	provide: 'queue:deliver',
	useFactory: (configLoaderService: ConfigLoaderService) =>
		new Bull.Queue(
			Queue.Deliver,
			baseQueueOptions(configLoaderService.data, Queue.Deliver),
		),
	inject: [ConfigLoaderService],
};

const $inbox: Provider = {
	provide: 'queue:inbox',
	useFactory: (configLoaderService: ConfigLoaderService) =>
		new Bull.Queue(
			Queue.Inbox,
			baseQueueOptions(configLoaderService.data, Queue.Inbox),
		),
	inject: [ConfigLoaderService],
};

const $db: Provider = {
	provide: 'queue:db',
	useFactory: (configLoaderService: ConfigLoaderService) =>
		new Bull.Queue(
			Queue.Db,
			baseQueueOptions(configLoaderService.data, Queue.Db),
		),
	inject: [ConfigLoaderService],
};

const $relationship: Provider = {
	provide: 'queue:relationship',
	useFactory: (configLoaderService: ConfigLoaderService) =>
		new Bull.Queue(
			Queue.Relationship,
			baseQueueOptions(configLoaderService.data, Queue.Relationship),
		),
	inject: [ConfigLoaderService],
};

const $objectStorage: Provider = {
	provide: 'queue:objectStorage',
	useFactory: (configLoaderService: ConfigLoaderService) =>
		new Bull.Queue(
			Queue.ObjectStorage,
			baseQueueOptions(configLoaderService.data, Queue.ObjectStorage),
		),
	inject: [ConfigLoaderService],
};

const $webhookDeliver: Provider = {
	provide: 'queue:webhookDeliver',
	useFactory: (configLoaderService: ConfigLoaderService) =>
		new Bull.Queue(
			Queue.WebhoookDeliver,
			baseQueueOptions(configLoaderService.data, Queue.WebhoookDeliver),
		),
	inject: [ConfigLoaderService],
};

@Module({
	imports: [],
	providers: [
		$system,
		$endedPollNotification,
		$deliver,
		$inbox,
		$db,
		$relationship,
		$objectStorage,
		$webhookDeliver,
	],
	exports: [
		$system,
		$endedPollNotification,
		$deliver,
		$inbox,
		$db,
		$relationship,
		$objectStorage,
		$webhookDeliver,
	],
})
export class QueueModule implements OnApplicationShutdown {
	constructor(
		@Inject('queue:system') public systemQueue: SystemQueue,
		@Inject('queue:endedPollNotification')
		public endedPollNotificationQueue: EndedPollNotificationQueue,
		@Inject('queue:deliver') public deliverQueue: DeliverQueue,
		@Inject('queue:inbox') public inboxQueue: InboxQueue,
		@Inject('queue:db') public dbQueue: DbQueue,
		@Inject('queue:relationship') public relationshipQueue: RelationshipQueue,
		@Inject('queue:objectStorage')
		public objectStorageQueue: ObjectStorageQueue,
		@Inject('queue:webhookDeliver')
		public webhookDeliverQueue: WebhookDeliverQueue,
	) {}

	public async dispose(): Promise<void> {
		if (NODE_ENV === 'test') {
			// XXX:
			// Shutting down the existing connections causes errors on Jest as
			// Misskey has asynchronous postgres/redis connections that are not
			// awaited.
			// Let's wait for some random time for them to finish.
			await setTimeout(5000);
		}
		await Promise.all([
			this.systemQueue.close(),
			this.endedPollNotificationQueue.close(),
			this.deliverQueue.close(),
			this.inboxQueue.close(),
			this.dbQueue.close(),
			this.relationshipQueue.close(),
			this.objectStorageQueue.close(),
			this.webhookDeliverQueue.close(),
		]);
	}

	public async onApplicationShutdown(): Promise<void> {
		await this.dispose();
	}
}
