import * as crypto from 'node:crypto';
import * as util from 'node:util';

const generateKeyPair = util.promisify(crypto.generateKeyPair);

type KeyPair = {
	publicKey: string;
	privateKey: string;
};

export async function genRsaKeyPair(modulusLength = 2048): Promise<KeyPair> {
	return await generateKeyPair('rsa', {
		modulusLength,
		publicKeyEncoding: {
			type: 'spki',
			format: 'pem',
		},
		privateKeyEncoding: {
			type: 'pkcs8',
			format: 'pem',
			cipher: undefined,
			passphrase: undefined,
		},
	});
}
