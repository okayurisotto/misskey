import { z } from 'zod';
import { MisskeyIdSchema } from './misc.js';

export const MeDetailedOnlySchema = z.object({
	avatarId: MisskeyIdSchema.nullable(),
	bannerId: MisskeyIdSchema.nullable(),
	injectFeaturedNote: z.boolean().nullable(),
	receiveAnnouncementEmail: z.boolean().nullable(),
	alwaysMarkNsfw: z.boolean().nullable(),
	autoSensitive: z.boolean().nullable(),
	carefulBot: z.boolean().nullable(),
	autoAcceptFollowed: z.boolean().nullable(),
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
	mutingNotificationTypes: z.array(z.string()).nullable(),
	emailNotificationTypes: z.array(z.string()).nullable(),
	email: z.string().nullable().optional(),
	emailVerified: z.boolean().nullable().optional(),
	securityKeysList: z.array(z.unknown()).optional(),
});
