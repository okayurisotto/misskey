import { z } from 'zod';
import { AnnouncementSchemaBase } from './AnnouncementSchemaBase.js';

export const AnnouncementForAdminSchema = AnnouncementSchemaBase.extend({
	reads: z.number(),
});
