import fs from 'fs'

import { Wallet, Contract, BigNumber } from 'ethers'
import { Web3Provider, InfuraProvider, JsonRpcProvider } from '@ethersproject/providers'
import { configureRewards, configureEscrow, deployWSwapTest, overrides } from './deployBasic'
import { expandTo18Decimals } from '../test/shared/utilities'
import { defaultAbiCoder } from '@ethersproject/abi'

import GovernorAlpha from '../build/GovernorAlpha.json'
import WSGov from '../build/WSGov.json'

const NETWORK_NAME = 'rinkeby' 

async function main() {
  try {
    let web3Provider = new InfuraProvider(NETWORK_NAME, 'b6b2750f2e9846fbb97c48b0cf8a5713')

    let wallet = new Wallet("0xca1a9a7c63de3fdc8bf62b02e6855527c74501d78add0315cd6b41271565ead1", web3Provider)
    overrides['nonce'] = await wallet.getTransactionCount()
    console.log(wallet.address)

    const governor = new Contract('0x348ED00EB6b670fa274b1D302Bfd3c6BD3E234BC', JSON.stringify(GovernorAlpha.abi), wallet)
    const govToken = new Contract('0x7ddf3436793664b87F37F232D97Ed609d687aDbC', JSON.stringify(WSGov.abi), wallet)

    const targets = ['0x7ddf3436793664b87F37F232D97Ed609d687aDbC']
    const values = [expandTo18Decimals(0)]
    const signatures = ['transfer(address,uint256)']
    const callDatas = [defaultAbiCoder.encode(['address', 'uint256'], [wallet.address, expandTo18Decimals(2)])]
    // await govToken.delegate(wallet.address, overrides)
    // overrides['nonce'] += 1
    await governor.propose(targets, values, signatures, callDatas, 'Second Propose for better life', {...overrides, gasLimit: 1000000})

  } catch(e) {
    console.log("Error accured. Please check error.txt")
    fs.writeFile('error.txt', JSON.stringify(e), () => {})
  }

}
main();