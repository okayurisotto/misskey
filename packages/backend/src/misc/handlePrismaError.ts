import { ApiError } from '@/server/api/error.js';
import type { PrismaClientKnownRequestError } from '@prisma/client/runtime/library.js';

// https://www.prisma.io/docs/reference/api-reference/error-reference#prisma-client-query-engine

export const handlePrismaError = (
	err: PrismaClientKnownRequestError,
): ApiError => {
	if (err.code === 'P2002') {
		return new ApiError({
			code: 'P2002',
			id: 'P2002',
			message: '一意制約違反により操作は失敗しました。',
			httpStatusCode: 400,
		});
	}

	if (err.code === 'P2003') {
		return new ApiError({
			code: 'P2003',
			id: 'P2003',
			message: '外部キー制約違反により操作は失敗しました。',
			httpStatusCode: 400,
		});
	}

	if (err.code === 'P2025') {
		return new ApiError({
			code: 'P2025',
			id: 'P2025',
			message: 'レコードが見つからなかったため操作は失敗しました。',
			httpStatusCode: 400,
		});
	}

	return new ApiError();
};
