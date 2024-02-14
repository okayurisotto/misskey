export interface Acct {
	username: string;
	host: string | null;
}

export const parse = (acct: string): Acct => {
	if (acct.startsWith('@')) {
		return parse(acct.substring(1));
	}

	const split = acct.split('@', 2);

	const username = split[0];
	if (username === undefined) throw new Error();

	const host = split[1] ?? null;

	return { username, host };
};
