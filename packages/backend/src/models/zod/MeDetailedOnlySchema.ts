import { z } from 'zod';
import { MisskeyIdSchema } from './misc.js';
import { UserPoliciesSchema } from './RolePoliciesSchema.js';
import { AchievementSchema } from './AchievementSchema.js';

const NotificationTypeSchema = z.enum([
	'follow',
	'mention',
	'reply',
	'renote',
	'quote',
	'reaction',
	'pollVote',
	'pollEnded',
	'receiveFollowRequest',
	'followRequestAccepted',
	'groupInvited',
	'achievementEarned',
	'app',
]);

export const MeDetailedOnlySchema = z.object({
	avatarId: MisskeyIdSchema.nullable(),
	bannerId: MisskeyIdSchema.nullable(),
	injectFeaturedNote: z.boolean(),
	receiveAnnouncementEmail: z.boolean(),
	alwaysMarkNsfw: z.boolean(),
	autoSensitive: z.boolean(),
	carefulBot: z.boolean(),
	autoAcceptFollowed: z.boolean(),
	noCrawle: z.boolean(),
	preventAiLearning: z.boolean(),
	isExplorable: z.boolean(),
	isDeleted: z.boolean(),
	hideOnlineStatus: z.boolean(),
	hasUnreadSpecifiedNotes: z.boolean(),
	hasUnreadMentions: z.boolean(),
	hasUnreadAnnouncement: z.boolean(),
	hasUnreadAntenna: z.boolean(),
	hasUnreadNotification: z.boolean(),
	hasPendingReceivedFollowRequest: z.boolean(),
	mutedWords: z.array(z.array(z.string())),
	mutedInstances: z.array(z.string()).nullable(),
	mutingNotificationTypes: z.array(NotificationTypeSchema),
	emailNotificationTypes: z.array(z.string()).nullable(),
	isAdmin: z.boolean().nullable().optional(),
	isModerator: z.boolean().nullable().optional(),
	policies: UserPoliciesSchema,
	loggedInDays: z.number().int(),
	hasUnreadChannel: z.literal(false),
	achievements: z.array(AchievementSchema),
});
