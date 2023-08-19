import { z } from 'zod';

export const UserFieldsSchema = z
	.array(z.object({ name: z.string(), value: z.string() }))
	.max(16);
