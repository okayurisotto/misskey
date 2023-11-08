import { setTimeout } from 'node:timers/promises';
import { Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import * as Bull from 'bullmq';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { Queue, baseQueueOptions } from '@/queue/const.js';
import type { Provider } from '@nestjs/common';
import type { DeliverJobData, InboxJobData, EndedPollNotificationJobData, WebhookDeliverJobData, RelationshipJobData } from '../queue/types.js';

export type SystemQueue = Bull.Queue<Record<string, unknown>>;
export type EndedPollNotificationQueue = Bull.Queue<EndedPollNotificationJobData>;
export type DeliverQueue = Bull.Queue<DeliverJobData>;
export type InboxQueue = Bull.Queue<InboxJobData>;
export type DbQueue = Bull.Queue;
export type RelationshipQueue = Bull.Queue<RelationshipJobData>;
export type ObjectStorageQueue = Bull.Queue;
export type WebhookDeliverQueue = Bull.Queue<WebhookDeliverJobData>;

const $system: Provider = {
	provide: 'queue:system',
	useFactory: (config: Config) => new Bull.Queue(Queue.System, baseQueueOptions(config, Queue.System)),
	inject: [DI.config],
};

const $endedPollNotification: Provider = {
	provide: 'queue:endedPollNotification',
	useFactory: (config: Config) => new Bull.Queue(Queue.EndedPollNotification, baseQueueOptions(config, Queue.EndedPollNotification)),
	inject: [DI.config],
};

const $deliver: Provider = {
	provide: 'queue:deliver',
	useFactory: (config: Config) => new Bull.Queue(Queue.Deliver, baseQueueOptions(config, Queue.Deliver)),
	inject: [DI.config],
};

const $inbox: Provider = {
	provide: 'queue:inbox',
	useFactory: (config: Config) => new Bull.Queue(Queue.Inbox, baseQueueOptions(config, Queue.Inbox)),
	inject: [DI.config],
};

const $db: Provider = {
	provide: 'queue:db',
	useFactory: (config: Config) => new Bull.Queue(Queue.Db, baseQueueOptions(config, Queue.Db)),
	inject: [DI.config],
};

const $relationship: Provider = {
	provide: 'queue:relationship',
	useFactory: (config: Config) => new Bull.Queue(Queue.Relationship, baseQueueOptions(config, Queue.Relationship)),
	inject: [DI.config],
};

const $objectStorage: Provider = {
	provide: 'queue:objectStorage',
	useFactory: (config: Config) => new Bull.Queue(Queue.ObjectStorage, baseQueueOptions(config, Queue.ObjectStorage)),
	inject: [DI.config],
};

const $webhookDeliver: Provider = {
	provide: 'queue:webhookDeliver',
	useFactory: (config: Config) => new Bull.Queue(Queue.WebhoookDeliver, baseQueueOptions(config, Queue.WebhoookDeliver)),
	inject: [DI.config],
};

@Module({
	imports: [
	],
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
		@Inject('queue:endedPollNotification') public endedPollNotificationQueue: EndedPollNotificationQueue,
		@Inject('queue:deliver') public deliverQueue: DeliverQueue,
		@Inject('queue:inbox') public inboxQueue: InboxQueue,
		@Inject('queue:db') public dbQueue: DbQueue,
		@Inject('queue:relationship') public relationshipQueue: RelationshipQueue,
		@Inject('queue:objectStorage') public objectStorageQueue: ObjectStorageQueue,
		@Inject('queue:webhookDeliver') public webhookDeliverQueue: WebhookDeliverQueue,
	) {}

	public async dispose(): Promise<void> {
		if (process.env['NODE_ENV'] === 'test') {
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

	async onApplicationShutdown(): Promise<void> {
		await this.dispose();
	}
}
