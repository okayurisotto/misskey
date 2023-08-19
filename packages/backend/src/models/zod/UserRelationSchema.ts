import { z } from 'zod';

export const UserRelationSchema = z.object({
	hasPendingFollowRequestFromYou: z.boolean(),
	hasPendingFollowRequestToYou: z.boolean(),
	isBlocked: z.boolean(),
	isBlocking: z.boolean(),
	isFollowed: z.boolean(),
	isFollowing: z.boolean(),
	isMuted: z.boolean(),
	isRenoteMuted: z.boolean(),
});
