import { z } from 'zod';

const PolicySchemaBase = z.object({
	useDefault: z.boolean(),
	priority: z.number(),
});

export const RolePoliciesSchema = z
	.object({
		alwaysMarkNsfw: PolicySchemaBase.extend({ value: z.boolean() }),
		antennaLimit: PolicySchemaBase.extend({ value: z.number() }),
		canHideAds: PolicySchemaBase.extend({ value: z.boolean() }),
		canInvite: PolicySchemaBase.extend({ value: z.boolean() }),
		canManageCustomEmojis: PolicySchemaBase.extend({ value: z.boolean() }),
		canPublicNote: PolicySchemaBase.extend({ value: z.boolean() }),
		canSearchNotes: PolicySchemaBase.extend({ value: z.boolean() }),
		clipLimit: PolicySchemaBase.extend({ value: z.number() }),
		driveCapacityMb: PolicySchemaBase.extend({ value: z.number() }),
		gtlAvailable: PolicySchemaBase.extend({ value: z.boolean() }),
		inviteExpirationTime: PolicySchemaBase.extend({ value: z.number() }),
		inviteLimit: PolicySchemaBase.extend({ value: z.number() }),
		inviteLimitCycle: PolicySchemaBase.extend({ value: z.number() }),
		ltlAvailable: PolicySchemaBase.extend({ value: z.boolean() }),
		noteEachClipsLimit: PolicySchemaBase.extend({ value: z.number() }),
		pinLimit: PolicySchemaBase.extend({ value: z.number() }),
		rateLimitFactor: PolicySchemaBase.extend({ value: z.number() }),
		userEachUserListsLimit: PolicySchemaBase.extend({ value: z.number() }),
		userListLimit: PolicySchemaBase.extend({ value: z.number() }),
		webhookLimit: PolicySchemaBase.extend({ value: z.number() }),
		wordMuteLimit: PolicySchemaBase.extend({ value: z.number() }),
	})
	.partial();

export const UserPoliciesSchema = z
	.object({
		alwaysMarkNsfw: z.boolean(),
		antennaLimit: z.number(),
		canHideAds: z.boolean(),
		canInvite: z.boolean(),
		canManageCustomEmojis: z.boolean(),
		canPublicNote: z.boolean(),
		canSearchNotes: z.boolean(),
		clipLimit: z.number(),
		driveCapacityMb: z.number(),
		gtlAvailable: z.boolean(),
		inviteExpirationTime: z.number(),
		inviteLimit: z.number(),
		inviteLimitCycle: z.number(),
		ltlAvailable: z.boolean(),
		noteEachClipsLimit: z.number(),
		pinLimit: z.number(),
		rateLimitFactor: z.number(),
		userEachUserListsLimit: z.number(),
		userListLimit: z.number(),
		webhookLimit: z.number(),
		wordMuteLimit: z.number(),
	})
	.partial();
