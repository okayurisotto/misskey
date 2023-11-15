export enum ProcessMessage {
	/**
	 * ユニットテストでMisskeyが子プロセスとして起動されたときに親プロセスへ送信する
	 */
	Ok = 'ok',

	/**
	 * ワーカーが自身を起動したプライマリへ送信する
	 */
	Ready = 'ready',

	/**
	 * Fastifyサーバーが起動に失敗したときにプライマリへ送信する
	 */
	ListenFailed = 'listenFailed',
}
