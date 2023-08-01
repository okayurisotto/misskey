import { z } from 'zod';
import { generateSchema } from '@anatine/zod-openapi';
import { Inject, Injectable } from '@nestjs/common';
import type {
	InstancesRepository,
	NoteReactionsRepository,
	NotesRepository,
	UsersRepository,
} from '@/models/index.js';
import { Endpoint } from '@/server/api/abstract-endpoint.js';
import { DI } from '@/di-symbols.js';
import NotesChart from '@/core/chart/charts/notes.js';
import UsersChart from '@/core/chart/charts/users.js';

const res = z.object({
	notesCount: z.number(),
	originalNotesCount: z.number(),
	usersCount: z.number(),
	originalUsersCount: z.number(),
	instances: z.number(),
	driveUsageLocal: z.number(),
	driveUsageRemote: z.number(),
});
export const meta = {
	requireCredential: false,
	tags: ['meta'],
	res: generateSchema(res),
} as const;

const paramDef_ = z.object({});
export const paramDef = generateSchema(paramDef_);

@Injectable()
// eslint-disable-next-line import/no-default-export
export default class extends Endpoint<
	typeof meta,
	typeof paramDef_,
	typeof res
> {
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.instancesRepository)
		private instancesRepository: InstancesRepository,

		@Inject(DI.noteReactionsRepository)
		private noteReactionsRepository: NoteReactionsRepository,

		private notesChart: NotesChart,
		private usersChart: UsersChart,
	) {
		super(meta, paramDef_, async () => {
			const notesChart = await this.notesChart.getChart('hour', 1, null);
			const notesCount = notesChart.local.total[0] + notesChart.remote.total[0];
			const originalNotesCount = notesChart.local.total[0];

			const usersChart = await this.usersChart.getChart('hour', 1, null);
			const usersCount = usersChart.local.total[0] + usersChart.remote.total[0];
			const originalUsersCount = usersChart.local.total[0];

			const [
				reactionsCount,
				//originalReactionsCount,
				instances,
			] = await Promise.all([
				this.noteReactionsRepository.count({ cache: 3600000 }), // 1 hour
				//this.noteReactionsRepository.count({ where: { userHost: IsNull() }, cache: 3600000 }),
				this.instancesRepository.count({ cache: 3600000 }),
			]);

			return {
				notesCount,
				originalNotesCount,
				usersCount,
				originalUsersCount,
				reactionsCount,
				//originalReactionsCount,
				instances,
				driveUsageLocal: 0,
				driveUsageRemote: 0,
			} satisfies z.infer<typeof res>;
		});
	}
}
