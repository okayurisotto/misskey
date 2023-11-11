import { Prisma } from '@prisma/client';

export function isDuplicateKeyValueError(e: unknown): boolean {
	if (e instanceof Prisma.PrismaClientKnownRequestError) {
		if (e.code === 'P2002') {
			return true;
		} else {
			return false;
		}
	} else {
		return false;
	}
}
