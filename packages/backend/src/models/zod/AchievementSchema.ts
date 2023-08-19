import { z } from 'zod';

export const AchievementSchema = z.object({
	name: z.string(),
	unlockedAt: z.number().int(),
});
