import fs from 'fs'

import { Wallet, Contract, BigNumber } from 'ethers'
import { Web3Provider, InfuraProvider, JsonRpcProvider } from '@ethersproject/providers'
import { deployContract, MockProvider } from 'ethereum-waffle'
import { expandTo18Decimals, getCurrentTimestamp, getCreate2Address } from '../test/shared/utilities'
import { AddressZero } from '@ethersproject/constants'
import { defaultAbiCoder } from '@ethersproject/abi'

import Timelock from '../build/Timelock.json'
import WSController from '../build/WSController.json'
import WSFactory from '../build/WSFactory.json'
import WSPair from '../build/WSPair.json'
import WSRouter from '../build/WSRouter.json'
import ERC20 from '../build/ERC20.json'
import WSGov from '../build/WSGov.json'
import GovernorAlpha from '../build/GovernorAlpha.json'

import WSProxyFactory from '../build/WSProxyFactory.json'
import WSProxyRouter from '../build/WSProxyRouter.json'
import WSProxyPair from '../build/WSProxyPair.json'

import Escrow from '../build/Escrow.json'

import StakingRewardsFactory from '../build/StakingRewardsFactory.json'


export let overrides = {
  gasPrice: 130000000000,
  nonce: 0
}

const BEGID_DEPLOY = new Date()
const DAY = 24 * 60 * 60
const YEAR = 365 * DAY

// Increase for real deploy
const GENESIS_TIMEOUT = 60

export const COMMUNITY_AMOUNTS =  [expandTo18Decimals(116000000), expandTo18Decimals(116000000), expandTo18Decimals(87000000), expandTo18Decimals(87000000), expandTo18Decimals(87000000), expandTo18Decimals(58000000), expandTo18Decimals(58000000), expandTo18Decimals(58000000), expandTo18Decimals(29000000), expandTo18Decimals(29000000), expandTo18Decimals(29000000)]
export const COMMUNITY_TIMINGS = [toUnixTime(increaseMonth(BEGID_DEPLOY, 4)), toUnixTime(increaseMonth(BEGID_DEPLOY, 8)), toUnixTime(increaseMonth(BEGID_DEPLOY, 16)), toUnixTime(increaseMonth(BEGID_DEPLOY, 20)), toUnixTime(increaseMonth(BEGID_DEPLOY, 24)), toUnixTime(increaseMonth(BEGID_DEPLOY, 28)), toUnixTime(increaseMonth(BEGID_DEPLOY, 32)), toUnixTime(increaseMonth(BEGID_DEPLOY, 36)), toUnixTime(increaseMonth(BEGID_DEPLOY, 40)), toUnixTime(increaseMonth(BEGID_DEPLOY, 44)), toUnixTime(increaseMonth(BEGID_DEPLOY, 48))]


function increaseMonth(date: Date, monthes: number): Date {
  let update = new Date(date.getTime())
  return new Date(update.setMonth(update.getMonth() + monthes))
}

function toUnixTime(date: Date): number {
  return Math.floor(date.getTime() / 1000)
}

export let SCHCEDULE_ESCROW: any = {
  // TEAM SCHEDULE
  '0x7C6F5AA9be0CC3ed8A83a5F30C62f2E7dC836Db6': {
    'amounts': [expandTo18Decimals(5000000), expandTo18Decimals(5000000), expandTo18Decimals(8333333), expandTo18Decimals(8333333), expandTo18Decimals(8333333), expandTo18Decimals(4166666667).div(1000), expandTo18Decimals(4166666667).div(1000), expandTo18Decimals(4166666667).div(1000), expandTo18Decimals(4166666667).div(1000), expandTo18Decimals(4166666667).div(1000), expandTo18Decimals(4166667665).div(1000)],
    'time': [toUnixTime(increaseMonth(BEGID_DEPLOY, 4)), toUnixTime(increaseMonth(BEGID_DEPLOY, 8)), toUnixTime(increaseMonth(BEGID_DEPLOY, 16)), toUnixTime(increaseMonth(BEGID_DEPLOY, 20)), toUnixTime(increaseMonth(BEGID_DEPLOY, 24)), toUnixTime(increaseMonth(BEGID_DEPLOY, 28)), toUnixTime(increaseMonth(BEGID_DEPLOY, 32)), toUnixTime(increaseMonth(BEGID_DEPLOY, 36)), toUnixTime(increaseMonth(BEGID_DEPLOY, 40)), toUnixTime(increaseMonth(BEGID_DEPLOY, 44)), toUnixTime(increaseMonth(BEGID_DEPLOY, 48))]
  },
  // ADVISER SCHEDULE
  '0x3b759cD2301e38d95C65515a13A86191a350d4EF': {
    'amounts': [expandTo18Decimals(2500000), expandTo18Decimals(2500000), expandTo18Decimals(2500000), expandTo18Decimals(2500000), expandTo18Decimals(2500000), expandTo18Decimals(2500000), expandTo18Decimals(2500000), expandTo18Decimals(2500000), expandTo18Decimals(2500000), expandTo18Decimals(2500000), expandTo18Decimals(2500000)],
    'time': [toUnixTime(increaseMonth(BEGID_DEPLOY, 4)), toUnixTime(increaseMonth(BEGID_DEPLOY, 8)), toUnixTime(increaseMonth(BEGID_DEPLOY, 16)), toUnixTime(increaseMonth(BEGID_DEPLOY, 20)), toUnixTime(increaseMonth(BEGID_DEPLOY, 24)), toUnixTime(increaseMonth(BEGID_DEPLOY, 28)), toUnixTime(increaseMonth(BEGID_DEPLOY, 32)), toUnixTime(increaseMonth(BEGID_DEPLOY, 36)), toUnixTime(increaseMonth(BEGID_DEPLOY, 40)), toUnixTime(increaseMonth(BEGID_DEPLOY, 44)), toUnixTime(increaseMonth(BEGID_DEPLOY, 48))]
  }
}


function delay(sec: number) {
    const ms = sec * 1000
    return new Promise( resolve => setTimeout(resolve, ms) );
}


// Compile ts
//tsc scripts/deployContracts.ts --target es2017 --module commonjs --moduleResolution node  --resolveJsonModule --esModuleInterop

export interface BaseDeploy {
  pairFactory: Contract,
  stakingFactory: Contract,
  govToken: Contract,
  governor: Contract,
  timelock: Contract,
  escrow: Contract,
  controller: Contract,
  router: Contract,
}

export async function deployWSwapTest(wallet: Wallet, wethAddress: String): Promise<BaseDeploy> {
  const nextMint = getCurrentTimestamp() + YEAR
  // deploy governace
  const timelock = await deployContract(wallet, Timelock, [AddressZero, 5 * DAY], {...overrides, gasLimit: 2000000})
  overrides['nonce'] += 1
  console.log(`Timelock: ${timelock.address}`)
  console.log(defaultAbiCoder.encode(['address', 'uint256'], [wallet.address, 5 * DAY]))

  const govToken = await deployContract(wallet, WSGov, [wallet.address, wallet.address, nextMint], overrides)
  overrides['nonce'] += 1
  console.log(`Governance Token: ${govToken.address}`)
  console.log(defaultAbiCoder.encode(['address', 'address', 'uint256'], [wallet.address, wallet.address, nextMint]))

  const governor = await deployContract(wallet, GovernorAlpha, [timelock.address, govToken.address], overrides)
  overrides['nonce'] += 1
  console.log(`Governance: ${governor.address}`)
  console.log(defaultAbiCoder.encode(['address', 'address'], [timelock.address, govToken.address]))
  await timelock.initiateAdmin(governor.address, overrides)
  overrides['nonce'] += 1
  await govToken.setMinter(timelock.address, overrides)
  overrides['nonce'] += 1


  // deploy Controller
  const factoryLogic = await deployContract(wallet, WSFactory, [], {...overrides, gasLimit: 1500000})
  overrides['nonce'] += 1
  const pairLogic = await deployContract(wallet, WSPair, [], {...overrides, gasLimit: 3000000})
  overrides['nonce'] += 1
  const routerLogic = await deployContract(wallet, WSRouter, [], {...overrides, gasLimit: 5000000})
  overrides['nonce'] += 1

  console.log("\n")
  console.log(`Factory logic: ${factoryLogic.address}`)
  console.log(`Pair logic: ${pairLogic.address}`)
  console.log(`Router logic: ${routerLogic.address}`)
  console.log("\n")

  const controller = await deployContract(wallet, WSController, [pairLogic.address], {...overrides, gasLimit: 800000})
  overrides['nonce'] += 1
  await controller.transferOwnership(timelock.address, overrides)
  overrides['nonce'] += 1
  console.log(`Controller: ${controller.address}`)
  console.log(defaultAbiCoder.encode(['address'], [pairLogic.address]))

  // deploy factory
  const factoryProxy = await deployContract(wallet, WSProxyFactory, [], {...overrides, gasLimit: 600000}) // used 582,041
  overrides['nonce'] += 1
  await factoryProxy.initialize(factoryLogic.address, timelock.address, [], {...overrides, gasLimit: 70000}) // used 50,540
  overrides['nonce'] += 1
  const factory = new Contract(factoryProxy.address, factoryLogic.interface, wallet)
  await factory.initialize(timelock.address, controller.address, {...overrides, gasLimit: 200000}) // failed more then 23,571 required
  overrides['nonce'] += 1
  console.log(`Factory: ${factory.address}`)

  // deploy router
  const routerProxy = await deployContract(wallet, WSProxyRouter, [], {...overrides, gasLimit: 700000}) // mostly 582,041 
  overrides['nonce'] += 1
  await routerProxy.initialize(routerLogic.address, timelock.address, [], {...overrides, gasLimit: 70000})
  overrides['nonce'] += 1
  const router = new Contract(routerProxy.address, routerLogic.interface, wallet)
  await router.initialize(factory.address, wethAddress, {...overrides, gasLimit: 200000})
  overrides['nonce'] += 1
  console.log(`Router: ${router.address}`)

  const escrow = await deployContract(wallet, Escrow, [govToken.address], {...overrides, gasLimit: 1500000}) // used 1,408,092
  overrides['nonce'] += 1
  console.log(`Escrow: ${escrow.address}`)

  const genesis = getCurrentTimestamp() + GENESIS_TIMEOUT

  const stakingFactory = await deployContract(wallet, StakingRewardsFactory, [govToken.address, genesis], {...overrides, gasLimit: 2500000}) // used 2,153,894
  overrides['nonce'] += 1
  console.log(`Staking: ${stakingFactory.address}`)
  console.log(defaultAbiCoder.encode(['address', 'uint256'], [govToken.address, genesis]))

  return {
    pairFactory: factory,
    stakingFactory,
    govToken,
    timelock,
    escrow,
    controller,
    router,
    governor
  }

}

async function deployPairRewards(factoryAddress: string, tokens: [string, string], rewardAmount: BigNumber, stakingFactory: Contract, result: BigNumber[]) {
  const pairAddress = getCreate2Address(factoryAddress, tokens,`0x${WSProxyPair.evm.bytecode.object}`)
  console.log(`Address created: ${pairAddress}`)
  await stakingFactory.deploy(pairAddress, rewardAmount, overrides)
  overrides['nonce'] += 1
  result.push(rewardAmount)
}

export async function configureRewards(stakingPairs: [string, string, BigNumber][], timelock: Contract, govToken: Contract, factoryPair: Contract,  stakingFactory: Contract): Promise<void> {
  console.log('Start deploy rewards staking.')
  let results: BigNumber[] = []
  for(let i = 0; i < stakingPairs.length; i++){
    const [token0, token1, amount] = stakingPairs[i]
    await deployPairRewards(factoryPair.address, [token0, token1], amount, stakingFactory, results)
  }

  console.log('Deploy reward staking finished.')
  const rewardsTotalAmount = results.reduce((a: BigNumber, b: BigNumber) => { return a.add(b) }, BigNumber.from(0))
  await govToken.transfer(stakingFactory.address, rewardsTotalAmount, overrides)
  overrides['nonce'] += 1

  console.log("Stake factory supplied with gov tokens.")
  await delay(GENESIS_TIMEOUT)

  // TODO This parts should be commeted for real deploy
  // await stakingFactory.notifyRewardAmounts({...overrides, gasLimit: 1500000}) // used 1000000 + more
  // overrides['nonce'] += 1
  // await stakingFactory.transferOwnership(timelock.address, overrides)
  // overrides['nonce'] += 1
  console.log('Finish staking notify')
}

export async function configureEscrow(govToken: Contract, timelock: Contract, escrow: Contract, adviserAccount: string) {
  console.log('Start Escrow configure.')
  SCHCEDULE_ESCROW[timelock.address] = {
    'amounts': COMMUNITY_AMOUNTS,
    'time': COMMUNITY_TIMINGS
  }

  console.log("SCHEDULE UPDATED")
  
  let totalEscrowAmount = BigNumber.from(0)
  for( let key in SCHCEDULE_ESCROW){
    totalEscrowAmount = SCHCEDULE_ESCROW[key]['amounts'].reduce((a: BigNumber, b: BigNumber) => { return a.add(b)}, totalEscrowAmount)
  }
  console.log('Total escrow calculated')
  await govToken.transfer(escrow.address, totalEscrowAmount, overrides)
  overrides['nonce'] += 1
  console.log('Transfered escrow expected amount')
  for( let key in SCHCEDULE_ESCROW){
    await escrow.addVestingSchedule(key, SCHCEDULE_ESCROW[key]['time'], SCHCEDULE_ESCROW[key]['amounts'], {...overrides, gasLimit: 1200000})
    overrides['nonce'] += 1
  }
  console.log('Finish append Vesting')
  await escrow.transferOwnership(timelock.address, overrides)
  overrides['nonce'] += 1

  console.log('Send left amount to timelock')
  await govToken.transfer(timelock.address, expandTo18Decimals(71000000), overrides)
  overrides['nonce'] += 1
  console.log('Send initial amount to adviser')
  await govToken.transfer(adviserAccount, expandTo18Decimals(2500000), overrides)
  overrides['nonce'] += 1

  console.log('Finish escrow configure.')
}

export async function makeNotifyRewardAmounts(stakingFactory: Contract, timelock: Contract) {
  await stakingFactory.notifyRewardAmounts({...overrides, gasLimit: 1500000})
  overrides['nonce'] += 1
  await stakingFactory.transferOwnership(timelock.address, overrides)
  overrides['nonce'] += 1
  console.log('Rewards notified')
}

async function notify(stakingFactoryAddress: string, timelockAddress: string, wallet: Wallet) {
  const stakingFactory = new Contract(stakingFactoryAddress, JSON.stringify(StakingRewardsFactory.abi), wallet)
  const timelock = new Contract(timelockAddress, JSON.stringify(Timelock.abi), wallet)
  return makeNotifyRewardAmounts(stakingFactory, timelock)
}

export async function makeDeploy(networkName: string, infuraId: string, adviserAccount: string, stakingPairs: [string, string, BigNumber][], wethAddress: string, secretKey: string) {
  try {
    let web3Provider = new InfuraProvider(networkName, infuraId)

    let wallet = new Wallet(secretKey, web3Provider)
    overrides['nonce'] = await wallet.getTransactionCount()
    console.log(wallet.address)

    const baseDeploy = await deployWSwapTest(wallet, wethAddress)
    await configureRewards(stakingPairs, baseDeploy.timelock, baseDeploy.govToken, baseDeploy.pairFactory, baseDeploy.stakingFactory)
    await configureEscrow(baseDeploy.govToken, baseDeploy.timelock, baseDeploy.escrow, adviserAccount)
    await makeNotifyRewardAmounts(baseDeploy.stakingFactory, baseDeploy.timelock)
  } catch(e) {
    console.log("Error accured. Please check error.txt")
    fs.writeFile('error.txt', JSON.stringify(e), () => {})
  }
}
