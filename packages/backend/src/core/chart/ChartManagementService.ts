import { Injectable } from '@nestjs/common';
import { NODE_ENV } from '@/env.js';
import FederationChart from './charts/federation.js';
import NotesChart from './charts/notes.js';
import UsersChart from './charts/users.js';
import ActiveUsersChart from './charts/active-users.js';
import InstanceChart from './charts/instance.js';
import PerUserNotesChart from './charts/per-user-notes.js';
import PerUserPvChart from './charts/per-user-pv.js';
import DriveChart from './charts/drive.js';
import PerUserReactionsChart from './charts/per-user-reactions.js';
import PerUserFollowingChart from './charts/per-user-following.js';
import PerUserDriveChart from './charts/per-user-drive.js';
import ApRequestChart from './charts/ap-request.js';
import type { OnApplicationShutdown } from '@nestjs/common';

const INTERVAL = 1000 * 60 * 20;

@Injectable()
export class ChartManagementService implements OnApplicationShutdown {
	private readonly charts;
	private saveIntervalId: NodeJS.Timer;

	constructor(
		federationChart: FederationChart,
		notesChart: NotesChart,
		usersChart: UsersChart,
		activeUsersChart: ActiveUsersChart,
		instanceChart: InstanceChart,
		perUserNotesChart: PerUserNotesChart,
		perUserPvChart: PerUserPvChart,
		driveChart: DriveChart,
		perUserReactionsChart: PerUserReactionsChart,
		perUserFollowingChart: PerUserFollowingChart,
		perUserDriveChart: PerUserDriveChart,
		apRequestChart: ApRequestChart,
	) {
		this.charts = [
			federationChart,
			notesChart,
			usersChart,
			activeUsersChart,
			instanceChart,
			perUserNotesChart,
			perUserPvChart,
			driveChart,
			perUserReactionsChart,
			perUserFollowingChart,
			perUserDriveChart,
			apRequestChart,
		];
	}

	private async tick(): Promise<void> {
		await Promise.all(this.charts.map((chart) => chart.save()));
	}

	public start(): void {
		this.saveIntervalId = setInterval(async () => {
			await this.tick();
		}, INTERVAL);
	}

	public async onApplicationShutdown(): Promise<void> {
		clearInterval(this.saveIntervalId);

		if (NODE_ENV !== 'test') {
			await Promise.all(this.charts.map((chart) => chart.save()));
		}
	}
}
