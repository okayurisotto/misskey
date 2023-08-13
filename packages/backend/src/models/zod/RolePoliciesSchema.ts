import { z } from 'zod';

const PolicySchemaBase = z.object({
	useDefault: z.boolean(),
	priority: z.number(),
});

export const RolePoliciesSchema = z
	.object({
		gtlAvailable: PolicySchemaBase.extend({ value: z.boolean() }),
		ltlAvailable: PolicySchemaBase.extend({ value: z.boolean() }),
		canPublicNote: PolicySchemaBase.extend({ value: z.boolean() }),
		canInvite: PolicySchemaBase.extend({ value: z.boolean() }),
		inviteLimit: PolicySchemaBase.extend({ value: z.number() }),
		inviteLimitCycle: PolicySchemaBase.extend({ value: z.number() }),
		inviteExpirationTime: PolicySchemaBase.extend({ value: z.number() }),
		canManageCustomEmojis: PolicySchemaBase.extend({ value: z.boolean() }),
		canSearchNotes: PolicySchemaBase.extend({ value: z.boolean() }),
		canHideAds: PolicySchemaBase.extend({ value: z.boolean() }),
		driveCapacityMb: PolicySchemaBase.extend({ value: z.number() }),
		alwaysMarkNsfw: PolicySchemaBase.extend({ value: z.boolean() }),
		pinLimit: PolicySchemaBase.extend({ value: z.number() }),
		antennaLimit: PolicySchemaBase.extend({ value: z.number() }),
		wordMuteLimit: PolicySchemaBase.extend({ value: z.number() }),
		webhookLimit: PolicySchemaBase.extend({ value: z.number() }),
		clipLimit: PolicySchemaBase.extend({ value: z.number() }),
		noteEachClipsLimit: PolicySchemaBase.extend({ value: z.number() }),
		userListLimit: PolicySchemaBase.extend({ value: z.number() }),
		userEachUserListsLimit: PolicySchemaBase.extend({ value: z.number() }),
		rateLimitFactor: PolicySchemaBase.extend({ value: z.number() }),
	})
	.partial();
