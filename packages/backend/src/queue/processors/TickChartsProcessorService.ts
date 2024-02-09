import { Injectable } from '@nestjs/common';
import FederationChart from '@/core/chart/charts/federation.js';
import NotesChart from '@/core/chart/charts/notes.js';
import UsersChart from '@/core/chart/charts/users.js';
import ActiveUsersChart from '@/core/chart/charts/active-users.js';
import InstanceChart from '@/core/chart/charts/instance.js';
import PerUserNotesChart from '@/core/chart/charts/per-user-notes.js';
import PerUserPvChart from '@/core/chart/charts/per-user-pv.js';
import DriveChart from '@/core/chart/charts/drive.js';
import PerUserReactionsChart from '@/core/chart/charts/per-user-reactions.js';
import PerUserFollowingChart from '@/core/chart/charts/per-user-following.js';
import PerUserDriveChart from '@/core/chart/charts/per-user-drive.js';
import ApRequestChart from '@/core/chart/charts/ap-request.js';
import { QueueLoggerService } from '../QueueLoggerService.js';

@Injectable()
export class TickChartsProcessorService {
	private readonly logger;

	constructor(
		private readonly federationChart: FederationChart,
		private readonly notesChart: NotesChart,
		private readonly usersChart: UsersChart,
		private readonly activeUsersChart: ActiveUsersChart,
		private readonly instanceChart: InstanceChart,
		private readonly perUserNotesChart: PerUserNotesChart,
		private readonly perUserPvChart: PerUserPvChart,
		private readonly driveChart: DriveChart,
		private readonly perUserReactionsChart: PerUserReactionsChart,
		private readonly perUserFollowingChart: PerUserFollowingChart,
		private readonly perUserDriveChart: PerUserDriveChart,
		private readonly apRequestChart: ApRequestChart,

		private readonly queueLoggerService: QueueLoggerService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('tick-charts');
	}

	public async process(): Promise<void> {
		this.logger.info('Tick charts...');

		await Promise.all([
			this.federationChart.tick(false),
			this.notesChart.tick(false),
			this.usersChart.tick(false),
			this.activeUsersChart.tick(false),
			this.instanceChart.tick(false),
			this.perUserNotesChart.tick(false),
			this.perUserPvChart.tick(false),
			this.driveChart.tick(false),
			this.perUserReactionsChart.tick(false),
			this.perUserFollowingChart.tick(false),
			this.perUserDriveChart.tick(false),
			this.apRequestChart.tick(false),
		]);

		this.logger.succ('All charts successfully ticked.');
	}
}
