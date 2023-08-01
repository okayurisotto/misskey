import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
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
	res: generateSchema(res),
} as const;

const paramDef_ = z.unknown();
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	typeof res
> {
	constructor(
		@Inject('queue:system') public systemQueue: SystemQueue,
		@Inject('queue:endedPollNotification')
		public endedPollNotificationQueue: EndedPollNotificationQueue,
		@Inject('queue:deliver') public deliverQueue: DeliverQueue,
		@Inject('queue:inbox') public inboxQueue: InboxQueue,
		@Inject('queue:db') public dbQueue: DbQueue,
		@Inject('queue:objectStorage')
		public objectStorageQueue: ObjectStorageQueue,
		@Inject('queue:webhookDeliver')
		public webhookDeliverQueue: WebhookDeliverQueue,
	) {
		super(meta, paramDef_, async (ps, me) => {
			const deliverJobCounts = await this.deliverQueue.getJobCounts();
			const inboxJobCounts = await this.inboxQueue.getJobCounts();
			const dbJobCounts = await this.dbQueue.getJobCounts();
			const objectStorageJobCounts =
				await this.objectStorageQueue.getJobCounts();

			return {
				deliver: deliverJobCounts,
				inbox: inboxJobCounts,
				db: dbJobCounts,
				objectStorage: objectStorageJobCounts,
			} satisfies z.infer<typeof res>;
		});
	}
}
