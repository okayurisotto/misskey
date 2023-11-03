export const id = (): { type: 'varchar', length: number } => ({
	type: 'varchar' as const,
	length: 32,
});
