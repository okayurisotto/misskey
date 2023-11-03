import { secureRndstr } from '@/misc/secure-rndstr.js';

export default (): string => secureRndstr(16);
