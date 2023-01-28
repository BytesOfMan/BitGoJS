import { CoinFamily } from '@bitgo/statics';

export const supportedCoins: string[] = [CoinFamily.ETH, CoinFamily.BSC, CoinFamily.POLYGON];
export type EvmWalletCoins = typeof supportedCoins[number];
