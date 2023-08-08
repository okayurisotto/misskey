import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import NotesChart from '@/core/chart/charts/notes.js';
import UsersChart from '@/core/chart/charts/users.js';
import { PrismaService } from '@/core/PrismaService.js';

const res = z.object({
	notesCount: z.number(),
	originalNotesCount: z.number(),
	usersCount: z.number(),
	originalUsersCount: z.number(),
	instances: z.number(),
	driveUsageLocal: z.number(),
	driveUsageRemote: z.number(),
	reactionsCount: z.number(),
});
export const meta = {
	requireCredential: false,
	tags: ['meta'],
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
		private readonly notesChart: NotesChart,
		private readonly usersChart: UsersChart,
		private readonly prismaService: PrismaService,
	) {
		super(meta, paramDef, async () => {
			const notesChart = await this.notesChart.getChart('hour', 1, null);
			const notesCount = notesChart.local.total[0] + notesChart.remote.total[0];
			const originalNotesCount = notesChart.local.total[0];

			const usersChart = await this.usersChart.getChart('hour', 1, null);
			const usersCount = usersChart.local.total[0] + usersChart.remote.total[0];
			const originalUsersCount = usersChart.local.total[0];

			const [reactionsCount, instances] = await Promise.all([
				this.prismaService.client.note.count(),
				this.prismaService.client.instance.count(),
			]);

			return {
				notesCount,
				originalNotesCount,
				usersCount,
				originalUsersCount,
				reactionsCount,
				instances,
				driveUsageLocal: 0,
				driveUsageRemote: 0,
			} satisfies z.infer<typeof res>;
		});
	}
}
