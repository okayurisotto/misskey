import { z } from 'zod';

export const QueueCountSchema = z.object({
	waiting: z.number(),
	active: z.number(),
	completed: z.number(),
	failed: z.number(),
	delayed: z.number(),
});
