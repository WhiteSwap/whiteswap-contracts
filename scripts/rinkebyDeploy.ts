import fs from 'fs'

import { Wallet, Contract, BigNumber } from 'ethers'
import { Web3Provider, InfuraProvider, JsonRpcProvider } from '@ethersproject/providers'
import { makeDeploy } from './deployBasic'
import { expandTo18Decimals } from '../test/shared/utilities'
import { INFURA_ID, SECRET_KEY} from './constants'

const NETWORK_NAME = 'rinkeby' 

const DAI_ADDRESS = '0xc7AD46e0b8a400Bb3C915120d284AafbA8fc4735'
const UNI_ADDRESS = '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'
const MKR_ADDRESS = '0xF9bA5210F91D0474bd1e1DcDAeC4C58E359AaD85'

const WETH_ADDRESS = '0xc778417E063141139Fce010982780140Aa0cD5Ab'

const STAKING_PAIRS: [string, string, BigNumber][] = [
  [WETH_ADDRESS, DAI_ADDRESS, expandTo18Decimals(8000000)],
  [WETH_ADDRESS, UNI_ADDRESS, expandTo18Decimals(8000000)],
  [WETH_ADDRESS, MKR_ADDRESS, expandTo18Decimals(2000000)]
]

// Fake account for now
const ADVISER_ACCOUNT = '0xA6829516BcB3393aF6b054B0A823d363069305A0'

async function main() {
  try {
    await makeDeploy(NETWORK_NAME, INFURA_ID, ADVISER_ACCOUNT, STAKING_PAIRS, WETH_ADDRESS, SECRET_KEY)
  } catch(e) {
    console.log("Error accured. Please check error.txt")
    fs.writeFile('error.txt', JSON.stringify(e), () => {})
  }

}
main();