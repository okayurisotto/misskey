export type Acct = {
	username: string;
	host: string | null;
};

export function parse(acct: string): Acct {
	if (acct.startsWith('@')) acct = acct.substring(1);
	const split = acct.split('@', 2);
	return { username: split[0], host: split[1] ?? null };
}
