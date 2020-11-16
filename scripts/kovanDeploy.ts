import fs from 'fs'

import { Wallet, Contract, BigNumber } from 'ethers'
import { Web3Provider, InfuraProvider, JsonRpcProvider } from '@ethersproject/providers'
import { makeDeploy } from './deployBasic'
import { expandTo18Decimals } from '../test/shared/utilities'
import { INFURA_ID, SECRET_KEY} from './constants'

const NETWORK_NAME = 'kovan' 

const DAI_ADDRESS = '0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa'
const UNI_ADDRESS = '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'
const MKR_ADDRESS = '0xF9bA5210F91D0474bd1e1DcDAeC4C58E359AaD85'

const WETH_ADDRESS = '0xd0A1E359811322d97991E03f863a0C30C2cF029C'

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
