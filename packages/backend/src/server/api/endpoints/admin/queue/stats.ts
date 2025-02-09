import { z } from 'zod';
import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import type {
	DbQueue,
	DeliverQueue,
	EndedPollNotificationQueue,
	InboxQueue,
	ObjectStorageQueue,
	SystemQueue,
	WebhookDeliverQueue,
} from '@/core/QueueModule.js';
import { QueueCountSchema } from '@/models/zod/QueueCountSchema.js';

const res = z.object({
	deliver: QueueCountSchema,
	inbox: QueueCountSchema,
	db: QueueCountSchema,
	objectStorage: QueueCountSchema,
});
export const meta = {
	tags: ['admin'],
	requireCredential: true,
	requireModerator: true,
	res,
} as const;

export const paramDef = z.object({});

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef,
	typeof res
> {
	constructor(
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
		@Inject('queue:objectStorage')
		public objectStorageQueue: ObjectStorageQueue,
		@Inject('queue:webhookDeliver')
		public webhookDeliverQueue: WebhookDeliverQueue,
	) {
		super(meta, paramDef, async () => {
			const [
				deliverJobCounts,
				inboxJobCounts,
				dbJobCounts,
				objectStorageJobCounts,
			] = await Promise.all([
				this.deliverQueue.getJobCounts(),
				this.inboxQueue.getJobCounts(),
				this.dbQueue.getJobCounts(),
				this.objectStorageQueue.getJobCounts(),
			]);

			return {
				deliver: QueueCountSchema.parse(deliverJobCounts),
				inbox: QueueCountSchema.parse(inboxJobCounts),
				db: QueueCountSchema.parse(dbJobCounts),
				objectStorage: QueueCountSchema.parse(objectStorageJobCounts),
			};
		});
	}
}
