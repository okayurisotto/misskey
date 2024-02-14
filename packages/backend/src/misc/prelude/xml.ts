const MAP: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	'\'': '&apos;',
};

const BEGINING_OF_CDATA = '<![CDATA[';
const END_OF_CDATA = ']]>';

export function escapeValue(x: string): string {
	let insideOfCDATA = false;
	let builder = '';
	for (
		let i = 0;
		i < x.length;
	) {
		if (insideOfCDATA) {
			if (x.slice(i, i + BEGINING_OF_CDATA.length) === BEGINING_OF_CDATA) {
				insideOfCDATA = true;
				i += BEGINING_OF_CDATA.length;
			} else {
				builder += x[i++];
			}
		} else {
			if (x.slice(i, i + END_OF_CDATA.length) === END_OF_CDATA) {
				insideOfCDATA = false;
				i += END_OF_CDATA.length;
			} else {
				const b = x[i++];
				builder += MAP[b] || b;
			}
		}
	}
	return builder;
}

export function escapeAttribute(x: string): string {
	return Object.entries(MAP).reduce((a, [k, v]) => a.replace(k, v), x);
}
