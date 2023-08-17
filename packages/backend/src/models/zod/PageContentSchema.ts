import { z } from 'zod';
import { defineOpenApiSpec } from 'zod2spec';

const PageContentSectionItemSchemaBase = z.object({
	id: z.string(),
	type: z.literal('section'),
	title: z.string().nullable(),
});
type PageContentSectionItemSchemaType = z.infer<
	typeof PageContentSectionItemSchemaBase
> & {
	children?: z.infer<typeof PageContentSchema>;
};
const PageContentSectionItemSchema: z.ZodType<PageContentSectionItemSchemaType> =
	PageContentSectionItemSchemaBase.extend({
		children: defineOpenApiSpec(
			z.lazy(() => PageContentSchema),
			{ $ref: '#/components/schemas/PageContent' },
		),
	});

const PageContentTextItemSchema = z.object({
	id: z.string(),
	type: z.literal('text'),
	text: z.string().optional(),
});

const PageContentNoteItemSchema = z.object({
	id: z.string(),
	type: z.literal('note'),
	note: z.string().optional(),
});

const PageContentImageItemSchema = z.object({
	id: z.string(),
	type: z.literal('image'),
	fileId: z.string().optional(),
});

const PageContentItemSchema = z.union([
	PageContentSectionItemSchema,
	PageContentTextItemSchema,
	PageContentNoteItemSchema,
	PageContentImageItemSchema,
]);

export const PageContentSchema = z.array(PageContentItemSchema);
