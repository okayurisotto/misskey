import { z } from 'zod';

const isUnique = <T extends string>(v: T[]): boolean =>
	v.length === new Set(v).size;

export const uniqueItems = <T extends z.ZodType>(
	schema: z.ZodArray<T>,
): z.ZodEffects<z.ZodArray<T>> => {
	return schema.refine(isUnique, { message: 'Array has duplicate items.' });
};

export const MisskeyIdSchema = z.string().regex(/^[a-zA-Z0-9]+$/);

export const MD5Schema = z.string().regex(/[A-Fa-f\d]{32}/);

export const LocalUsernameSchema = z.string().regex(/^\w{1,20}$/);

export const PasswordSchema = z.string().min(1);

export const NameSchema = z.string().min(1).max(50);

export const DescriptionSchema = z.string().min(1).max(1500);

export const LocationSchema = z.string().min(1).max(50);

export const BirthdaySchema = z
	.string()
	.regex(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);

export const limit = (opts: {
	min?: number;
	max: number;
	default: number;
}): z.ZodDefault<z.ZodNumber> => {
	return z
		.number()
		.int()
		.min(opts.min ?? 1)
		.max(opts.max)
		.default(opts.default);
};

export const PaginationSchema = z.object({
	sinceId: MisskeyIdSchema.optional(),
	untilId: MisskeyIdSchema.optional(),
	sinceDate: z.number().int().optional(),
	untilDate: z.number().int().optional(),
});
