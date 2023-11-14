import { BufferGenerator } from 'identicon-generator';

const IDENTICON_CACHE_LIMIT = 1000;

const bufferGenerator = new BufferGenerator(IDENTICON_CACHE_LIMIT, {
	cellSize: 16,
	imageSize: 64 * 3,
	resolution: 5,
});

export const genIdenticon = async (seed: string): Promise<ArrayBuffer> => {
	return await bufferGenerator.compute(seed);
};
