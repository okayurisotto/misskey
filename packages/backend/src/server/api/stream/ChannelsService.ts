import { Injectable } from '@nestjs/common';
import { HybridTimelineChannelService } from './channels/hybrid-timeline.js';
import { LocalTimelineChannelService } from './channels/local-timeline.js';
import { HomeTimelineChannelService } from './channels/home-timeline.js';
import { GlobalTimelineChannelService } from './channels/global-timeline.js';
import { MainChannelService } from './channels/main.js';
import { ChannelChannelService } from './channels/channel.js';
import { AdminChannelService } from './channels/admin.js';
import { ServerStatsChannelService } from './channels/server-stats.js';
import { QueueStatsChannelService } from './channels/queue-stats.js';
import { UserListChannelService } from './channels/user-list.js';
import { AntennaChannelService } from './channels/antenna.js';
import { DriveChannelService } from './channels/drive.js';
import { HashtagChannelService } from './channels/hashtag.js';
import { RoleTimelineChannelService } from './channels/role-timeline.js';

type ChannelServices = {
	main: MainChannelService;
	homeTimeline: HomeTimelineChannelService;
	localTimeline: LocalTimelineChannelService;
	hybridTimeline: HybridTimelineChannelService;
	globalTimeline: GlobalTimelineChannelService;
	userList: UserListChannelService;
	hashtag: HashtagChannelService;
	roleTimeline: RoleTimelineChannelService;
	antenna: AntennaChannelService;
	channel: ChannelChannelService;
	drive: DriveChannelService;
	serverStats: ServerStatsChannelService;
	queueStats: QueueStatsChannelService;
	admin: AdminChannelService;
};

export const channelServiceNames = [
	'main',
	'homeTimeline',
	'localTimeline',
	'hybridTimeline',
	'globalTimeline',
	'userList',
	'hashtag',
	'roleTimeline',
	'antenna',
	'channel',
	'drive',
	'serverStats',
	'queueStats',
	'admin',
] as const satisfies readonly (keyof ChannelServices)[];

export type ChannelServiceName = (typeof channelServiceNames)[number];

@Injectable()
export class ChannelsService {
	private readonly services;

	constructor(
		mainChannelService: MainChannelService,
		homeTimelineChannelService: HomeTimelineChannelService,
		localTimelineChannelService: LocalTimelineChannelService,
		hybridTimelineChannelService: HybridTimelineChannelService,
		globalTimelineChannelService: GlobalTimelineChannelService,
		userListChannelService: UserListChannelService,
		hashtagChannelService: HashtagChannelService,
		roleTimelineChannelService: RoleTimelineChannelService,
		antennaChannelService: AntennaChannelService,
		channelChannelService: ChannelChannelService,
		driveChannelService: DriveChannelService,
		serverStatsChannelService: ServerStatsChannelService,
		queueStatsChannelService: QueueStatsChannelService,
		adminChannelService: AdminChannelService,
	) {
		this.services = {
			main: mainChannelService,
			homeTimeline: homeTimelineChannelService,
			localTimeline: localTimelineChannelService,
			hybridTimeline: hybridTimelineChannelService,
			globalTimeline: globalTimelineChannelService,
			userList: userListChannelService,
			hashtag: hashtagChannelService,
			roleTimeline: roleTimelineChannelService,
			antenna: antennaChannelService,
			channel: channelChannelService,
			drive: driveChannelService,
			serverStats: serverStatsChannelService,
			queueStats: queueStatsChannelService,
			admin: adminChannelService,
		};
	}

	public getChannelService<K extends ChannelServiceName>(
		name: K,
	): ChannelServices[K] {
		return this.services[name];
	}
}
