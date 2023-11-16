import { Injectable } from '@nestjs/common';
import Xev from 'xev';
import * as Bull from 'bullmq';
import { QueueService } from '@/core/QueueService.js';
import { Queue, baseQueueOptions } from '@/queue/const.js';
import { ConfigLoaderService } from '@/ConfigLoaderService.js';
import type { OnApplicationShutdown } from '@nestjs/common';

const ev = new Xev();

const INTERVAL = 10000;

@Injectable()
export class QueueStatsService implements OnApplicationShutdown {
	private intervalId: NodeJS.Timer;

	constructor(
		private readonly configLoaderService: ConfigLoaderService,

		private readonly queueService: QueueService,
	) {}

	public async start(): Promise<void> {
		const log: unknown[] = [];

		ev.on('requestQueueStatsLog', (x) => {
			ev.emit(`queueStatsLog:${x.id}`, log.slice(0, x.length ?? 50));
		});

		let activeDeliverJobs = 0;
		let activeInboxJobs = 0;

		const deliverQueueEvents = new Bull.QueueEvents(
			Queue.Deliver,
			baseQueueOptions(this.configLoaderService.data, Queue.Deliver),
		);
		const inboxQueueEvents = new Bull.QueueEvents(
			Queue.Inbox,
			baseQueueOptions(this.configLoaderService.data, Queue.Inbox),
		);

		deliverQueueEvents.on('active', () => {
			activeDeliverJobs++;
		});

		inboxQueueEvents.on('active', () => {
			activeInboxJobs++;
		});

		const tick = async (): Promise<void> => {
			const [deliverJobCounts, inboxJobCounts] = await Promise.all([
				this.queueService.deliverQueue.getJobCounts(),
				this.queueService.inboxQueue.getJobCounts(),
			]);

			const stats = {
				deliver: {
					activeSincePrevTick: activeDeliverJobs,
					active: deliverJobCounts['active'],
					waiting: deliverJobCounts['waiting'],
					delayed: deliverJobCounts['delayed'],
				},
				inbox: {
					activeSincePrevTick: activeInboxJobs,
					active: inboxJobCounts['active'],
					waiting: inboxJobCounts['waiting'],
					delayed: inboxJobCounts['delayed'],
				},
			};

			ev.emit('queueStats', stats);

			log.unshift(stats);
			if (log.length > 200) log.pop();

			activeDeliverJobs = 0;
			activeInboxJobs = 0;
		};

		await tick();

		this.intervalId = setInterval(async () => {
			await tick();
		}, INTERVAL);
	}

	public onApplicationShutdown(): void {
		clearInterval(this.intervalId);
	}
}
