import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { User } from '@/models/entities/User.js';
import { bindThis } from '@/decorators.js';
import { NotificationService } from '@/core/NotificationService.js';
import { PrismaService } from '@/core/PrismaService.js';

export const ACHIEVEMENT_TYPES = [
	'notes1',
	'notes10',
	'notes100',
	'notes500',
	'notes1000',
	'notes5000',
	'notes10000',
	'notes20000',
	'notes30000',
	'notes40000',
	'notes50000',
	'notes60000',
	'notes70000',
	'notes80000',
	'notes90000',
	'notes100000',
	'login3',
	'login7',
	'login15',
	'login30',
	'login60',
	'login100',
	'login200',
	'login300',
	'login400',
	'login500',
	'login600',
	'login700',
	'login800',
	'login900',
	'login1000',
	'passedSinceAccountCreated1',
	'passedSinceAccountCreated2',
	'passedSinceAccountCreated3',
	'loggedInOnBirthday',
	'loggedInOnNewYearsDay',
	'noteClipped1',
	'noteFavorited1',
	'myNoteFavorited1',
	'profileFilled',
	'markedAsCat',
	'following1',
	'following10',
	'following50',
	'following100',
	'following300',
	'followers1',
	'followers10',
	'followers50',
	'followers100',
	'followers300',
	'followers500',
	'followers1000',
	'collectAchievements30',
	'viewAchievements3min',
	'iLoveMisskey',
	'foundTreasure',
	'client30min',
	'client60min',
	'noteDeletedWithin1min',
	'postedAtLateNight',
	'postedAt0min0sec',
	'selfQuote',
	'htl20npm',
	'viewInstanceChart',
	'outputHelloWorldOnScratchpad',
	'open3windows',
	'driveFolderCircularReference',
	'reactWithoutRead',
	'clickedClickHere',
	'justPlainLucky',
	'setNameToSyuilo',
	'cookieClicked',
	'brainDiver',
] as const;

@Injectable()
export class AchievementService {
	constructor(
		private readonly notificationService: NotificationService,
		private readonly prismaService: PrismaService,
	) {}

	@bindThis
	public async create(
		userId: User['id'],
		type: typeof ACHIEVEMENT_TYPES[number],
	): Promise<void> {
		if (!ACHIEVEMENT_TYPES.includes(type)) return;

		const date = Date.now();

		const profile = await this.prismaService.client.user_profile.findUniqueOrThrow({ where: { userId: userId } });

		const achievements = z.array(z.object({
			name: z.string(),
			unlockedAt: z.number(),
		})).parse(profile.achievements);

		if (achievements.some(a => a.name === type)) return;

		await this.prismaService.client.user_profile.update({
			where: { userId: userId },
			data: { achievements: [...achievements, { name: type, unlockedAt: date }] },
		});

		this.notificationService.createNotification(
			userId,
			'achievementEarned',
			{ achievement: type },
		);
	}
}
