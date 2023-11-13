export const range = ({ start = 0, stop = 0, step = 1 }) => {
	const length = Math.ceil((stop - start) / step);
	const result = new Array(length).fill(null).map((_, i) => start + step * i);
	return result;
};
