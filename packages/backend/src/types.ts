export const notificationTypes = ['follow', 'mention', 'reply', 'renote', 'quote', 'reaction', 'pollEnded', 'receiveFollowRequest', 'followRequestAccepted', 'achievementEarned', 'app'] as const;
export const obsoleteNotificationTypes = ['pollVote', 'groupInvited'] as const;

export const noteVisibilities = ['public', 'home', 'followers', 'specified'] as const;

export const mutedNoteReasons = ['word', 'manual', 'spam', 'other'] as const;

export const ffVisibility = ['public', 'followers', 'private'] as const;

type Intersection<L, R> = {
	[K in keyof L & keyof R]: L[K] extends R[K] ? R[K] extends L[K] ? L[K] : L[K] | R[K] : L[K] | R[K];
}

/** TypeORMからPrismaへ移行するために、それらの型定義をうまくマージする型 */
export type T2P<L, R> = Intersection<L, R>;
