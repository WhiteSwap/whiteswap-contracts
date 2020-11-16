import fs from 'fs'

import { Wallet, Contract, BigNumber } from 'ethers'
import { Web3Provider, InfuraProvider, JsonRpcProvider } from '@ethersproject/providers'
import { makeDeploy } from './deployBasic'
import { expandTo18Decimals } from '../test/shared/utilities'
import { INFURA_ID, SECRET_KEY} from './constants'

const NETWORK_NAME = 'mainnet' 

const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const TUSD_ADDRESS = '0x0000000000085d4780B73119b644AE5ecd22b376'
const DAI_ADDRESS = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
const WBTC_ADDRESS = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
const CORE_ADDRESS = '0x62359Ed7505Efc61FF1D56fEF82158CcaffA23D7'
const YFI_ADDRESS = '0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e'
const LINK_ADDRESS = '0x514910771AF9Ca656af840dff83E8264EcF986CA'

export const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'

export const STAKING_PAIRS: [string, string, BigNumber][] = [
  [WETH_ADDRESS, USDT_ADDRESS, expandTo18Decimals(9000000)],
  [WETH_ADDRESS, USDC_ADDRESS, expandTo18Decimals(9000000)],
  [WETH_ADDRESS, DAI_ADDRESS, expandTo18Decimals(8000000)],
  [WETH_ADDRESS, WBTC_ADDRESS, expandTo18Decimals(8000000)],
  [USDT_ADDRESS, USDC_ADDRESS, expandTo18Decimals(2500000)],
  [USDT_ADDRESS, TUSD_ADDRESS, expandTo18Decimals(2500000)],
  [WETH_ADDRESS, CORE_ADDRESS, expandTo18Decimals(2000000)],
  [WETH_ADDRESS, YFI_ADDRESS, expandTo18Decimals(2000000)],
  [WETH_ADDRESS, LINK_ADDRESS, expandTo18Decimals(2000000)]
]

// Fake account for now
export const TEAM_ACCOUNT = '0x7C6F5AA9be0CC3ed8A83a5F30C62f2E7dC836Db6'
export const ADVISER_ACCOUNT = '0x3b759cD2301e38d95C65515a13A86191a350d4EF'

async function main() {
  try {
    await makeDeploy(NETWORK_NAME, INFURA_ID, ADVISER_ACCOUNT, STAKING_PAIRS, WETH_ADDRESS, SECRET_KEY)
  } catch(e) {
    console.log("Error accured. Please check error.txt")
    fs.writeFile('error.txt', JSON.stringify(e), () => {})
  }

}
if (require.main === module) {
    main();
} 
