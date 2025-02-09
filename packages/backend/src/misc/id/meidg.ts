const CHARS = '0123456789abcdef';

//  4bit Fixed hex value 'g'
// 44bit UNIX Time ms in Hex
// 48bit Random value in Hex
export const meidgRegExp = /^g[0-9a-f]{23}$/;

function getTime(time: number): string {
	if (time < 0) time = 0;
	if (time === 0) {
		return CHARS[0];
	}

	return time.toString(16).padStart(11, CHARS[0]);
}

function getRandom(): string {
	let str = '';

	for (let i = 0; i < 12; i++) {
		str += CHARS[Math.floor(Math.random() * CHARS.length)];
	}

	return str;
}

export function genMeidg(date: Date): string {
	return 'g' + getTime(date.getTime()) + getRandom();
}

export function parseMeidg(id: string): { date: Date; } {
	return {
		date: new Date(parseInt(id.slice(1, 12), 16)),
	};
}
