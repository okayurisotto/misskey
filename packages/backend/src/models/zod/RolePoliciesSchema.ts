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

export const UserPoliciesSchema = z
	.object({
		gtlAvailable: z.boolean(),
		ltlAvailable: z.boolean(),
		canPublicNote: z.boolean(),
		canInvite: z.boolean(),
		inviteLimit: z.number(),
		inviteLimitCycle: z.number(),
		inviteExpirationTime: z.number(),
		canManageCustomEmojis: z.boolean(),
		canSearchNotes: z.boolean(),
		canHideAds: z.boolean(),
		driveCapacityMb: z.number(),
		alwaysMarkNsfw: z.boolean(),
		pinLimit: z.number(),
		antennaLimit: z.number(),
		wordMuteLimit: z.number(),
		webhookLimit: z.number(),
		clipLimit: z.number(),
		noteEachClipsLimit: z.number(),
		userListLimit: z.number(),
		userEachUserListsLimit: z.number(),
		rateLimitFactor: z.number(),
	})
	.partial();
