import { Config } from '@/config.js';
import type * as Bull from 'bullmq';

export enum Queue {
	Deliver = 'deliver',
	Inbox = 'inbox',
	System = 'system',
	EndedPollNotification = 'endedPollNotification',
	Db = 'db',
	Relationship = 'relationship',
	ObjectStorage = 'objectStorage',
	WebhoookDeliver = 'webhookDeliver',
}

export function baseQueueOptions(config: Config, queueName: Queue): Bull.QueueOptions {
	return {
		connection: {
			...config.redisForJobQueue,
			keyPrefix: undefined
		},
		prefix: config.redisForJobQueue.prefix ? `${config.redisForJobQueue.prefix}:queue:${queueName}` : `queue:${queueName}`,
	};
}
