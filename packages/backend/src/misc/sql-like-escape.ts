export function sqlLikeEscape(s: string): string {
	return s.replace(/([%_])/g, '\\$1');
}
