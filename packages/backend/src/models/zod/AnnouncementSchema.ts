import { z } from 'zod';
import { AnnouncementSchemaBase } from './AnnouncementSchemaBase.js';

export const AnnouncementSchema = AnnouncementSchemaBase.extend({
	isRead: z.boolean().optional(),
});
