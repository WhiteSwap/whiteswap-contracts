import { Wallet, Contract, BigNumber } from 'ethers'
import { Web3Provider } from '@ethersproject/providers'
import { deployContract } from 'ethereum-waffle'
import { AddressZero } from '@ethersproject/constants'

import { expandTo18Decimals } from './utilities'

import Timelock from '../../build/Timelock.json'
import WSGov from '../../build/WSGov.json'
import WSController from '../../build/WSController.json'
import WSFactory from '../../build/WSFactory.json'
import IWSPair from '../../build/IWSPair.json'
import IWSERC20 from '../../build/IWSERC20.json'
import WSPair from '../../build/WSPair.json'

import ERC20 from '../../build/ERC20.json'
import WETH9 from '../../build/WETH9.json'
import WSRouter from '../../build/WSRouter.json'
import RouterEventEmitter from '../../build/RouterEventEmitter.json'

import WSProxyFactory from '../../build/WSProxyFactory.json'
import WSProxyRouter from '../../build/WSProxyRouter.json'

import WSUpdate from '../../build/WSUpdate.json'
import WSPairUpdate from '../../build/WSPairUpdate.json'

import Escrow from '../../build/Escrow.json'

import GovernorAlpha from '../../build/GovernorAlpha.json'

import StakingRewards from '../../build/StakingRewards.json'
import StakingRewardsFactory from '../../build/StakingRewardsFactory.json'

const overrides = {
  gasLimit: 9999999
}

const TEST_ADDRESS: [string, string] = [
  '0x1000000000000000000000000000000000000000',
  '0x2000000000000000000000000000000000000000'
]


interface GovFixture {
  govToken: Contract
}

export async function govFixture([wallet]: Wallet[], provider: Web3Provider): Promise<GovFixture> {
  const nextMint = Math.round(Date.now() / 1000) + 365 * 24 * 60 * 60
  const govToken = await deployContract(wallet, WSGov, [wallet.address, wallet.address, nextMint], overrides)
  return { govToken }
}

interface FactoryFixture {
  factory: Contract
}

export async function factoryFixture([wallet]: Wallet[], provider: Web3Provider): Promise<FactoryFixture> {
  const factoryLogic = await deployContract(wallet, WSFactory, [], overrides)
  const pairLogic = await deployContract(wallet, WSPair, [], overrides)
  
  const controller = await deployContract(wallet, WSController, [pairLogic.address], overrides)
  const factoryProxy = await deployContract(wallet, WSProxyFactory, [], overrides)
  await factoryProxy.initialize(factoryLogic.address, controller.address, [])
  const factory = new Contract(factoryProxy.address, factoryLogic.interface, wallet)
  await factory.initialize(wallet.address, controller.address)

  return { factory }
}

interface PairFixture extends FactoryFixture {
  token0: Contract
  token1: Contract
  pair: Contract
}

export async function pairFixture([wallet]: Wallet[], provider: Web3Provider): Promise<PairFixture> {
  const { factory } = await factoryFixture([wallet], provider)

  const tokenA = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)], overrides)
  const tokenB = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)], overrides)

  await factory.createPair(tokenA.address, tokenB.address, overrides)
  const pairAddress = await factory.getPair(tokenA.address, tokenB.address)
  const pair = new Contract(pairAddress, JSON.stringify(WSPair.abi), provider).connect(wallet)

  const token0Address = await pair.token0()
  const token0 = tokenA.address === token0Address ? tokenA : tokenB
  const token1 = tokenA.address === token0Address ? tokenB : tokenA

  return { factory, token0, token1, pair }
}

interface TimelockFixture {
  timelock: Contract
}

export async function TimelockFixture([wallet]: Wallet[], provider: Web3Provider): Promise<TimelockFixture> {
  const timelock = await deployContract(wallet, Timelock, [wallet.address, 7 * 24 * 60 * 60])
  return {
    timelock
  }
}

interface Fixture {
  token0: Contract
  token1: Contract
  WETH: Contract
  WETHPartner: Contract
  factory: Contract
  routerEventEmitter: Contract
  router: Contract
  pair: Contract,
  pairToken: Contract,
  WETHPair: Contract,
  WETHPairToken: Contract,
  factoryLogic:Contract,
  pairLogic:Contract,
  routerLogic: Contract,
  controller: Contract,
  updateContract: Contract
  updatePairContract: Contract
}

export async function Fixture([wallet]: Wallet[], provider: Web3Provider): Promise<Fixture> {
  // deploy tokens
  const tokenA = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)])
  const tokenB = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)])
  const WETH = await deployContract(wallet, WETH9)
  const WETHPartner = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)])
  const updateContract = await deployContract(wallet, WSUpdate)
  const updatePairContract = await deployContract(wallet, WSPairUpdate)

  
  // deploy Controller
  const factoryLogic = await deployContract(wallet, WSFactory, [], overrides)
  const pairLogic = await deployContract(wallet, WSPair, [], overrides)
  const routerLogic = await deployContract(wallet, WSRouter, [], overrides)
  
  const controller = await deployContract(wallet, WSController, [pairLogic.address], overrides)

  // deploy factory
  const factoryProxy = await deployContract(wallet, WSProxyFactory, [], overrides)
  await factoryProxy.initialize(factoryLogic.address, controller.address, [])
  const factory = new Contract(factoryProxy.address, factoryLogic.interface, wallet)
  await factory.initialize(wallet.address, controller.address)

  // deploy router
  const routerProxy = await deployContract(wallet, WSProxyRouter, [], overrides)
  await routerProxy.initialize(routerLogic.address, controller.address, [])
  const router = new Contract(routerProxy.address, routerLogic.interface, wallet)
  await router.initialize(factory.address, WETH.address)

  // event emitter for testing
  const routerEventEmitter = await deployContract(wallet, RouterEventEmitter, [factory.address, WETH.address])

  // initialize 
  await factory.createPair(tokenA.address, tokenB.address, overrides)
  const pairAddress = await factory.getPair(tokenA.address, tokenB.address)
  const pair = new Contract(pairAddress, JSON.stringify(IWSPair.abi), provider).connect(wallet)
  const pairToken = new Contract(pairAddress, JSON.stringify(IWSERC20.abi), provider).connect(wallet)

  const token0Address = await pair.token0()
  const token0 = tokenA.address === token0Address ? tokenA : tokenB
  const token1 = tokenA.address === token0Address ? tokenB : tokenA

  await factory.createPair(WETH.address, WETHPartner.address, overrides)
  const WETHPairAddress = await factory.getPair(WETH.address, WETHPartner.address)
  const WETHPair = new Contract(WETHPairAddress, JSON.stringify(IWSPair.abi), provider).connect(wallet)
  const WETHPairToken = new Contract(WETHPairAddress, JSON.stringify(IWSERC20.abi), provider).connect(wallet)

  return {
    token0,
    token1,
    WETH,
    WETHPartner,
    factory: factory,
    router: router,
    routerEventEmitter,
    pair,
    pairToken,
    WETHPair,
    WETHPairToken,
    factoryLogic,
    pairLogic,
    routerLogic,
    controller,
    updateContract,
    updatePairContract
  }
}

interface EscrowFixture {
  token: Contract,
  escrow: Contract
}

export async function EscrowFixture([wallet]: Wallet[], provider: Web3Provider): Promise<EscrowFixture> {
  const token = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)])
  const escrow = await deployContract(wallet, Escrow, [token.address])
  return {
    token,
    escrow
  }
}

interface GovernanceFixture {
  govToken: Contract,
  governor: Contract,
  timelock: Contract,
  token: Contract
}

export async function GovernanceFixture([wallet]: Wallet[], provider: Web3Provider): Promise<GovernanceFixture> {
  const token = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)])
  const nextMint = Math.round(Date.now() / 1000) + 365 * 24 * 60 * 60
  const timelock = await deployContract(wallet, Timelock, [AddressZero, 4 * 24 * 60 * 60])
  const govToken = await deployContract(wallet, WSGov, [wallet.address, wallet.address, nextMint], overrides)
  const governor = await deployContract(wallet, GovernorAlpha, [timelock.address, govToken.address], overrides)
  await timelock.initiateAdmin(governor.address)

  return {
    govToken,
    governor,
    timelock,
    token
  }
}

interface IntegrationFixture {
  govToken: Contract,
  governor: Contract,
  timelock: Contract,
  escrow: Contract,
  token0: Contract,
  token1: Contract,
  WETH: Contract,
  factory: Contract,
  router: Contract,
  pair: Contract,
  pairToken: Contract,
  WETHPair: Contract,
  WETHPairToken: Contract,
  factoryLogic:Contract,
  pairLogic:Contract,
  routerLogic: Contract,
  controller: Contract,
  updateContract: Contract,
  updatePairContract: Contract
}

export async function IntegrationFixture([wallet]: Wallet[], provider: Web3Provider): Promise<IntegrationFixture> {
  const nextMint = Math.round(Date.now() / 1000) + 365 * 24 * 60 * 60
  // deploy tokens
  const token0 = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)])
  const token1 = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)])
  const WETH = await deployContract(wallet, WETH9)
  const updateContract = await deployContract(wallet, WSUpdate)
  const updatePairContract = await deployContract(wallet, WSPairUpdate)

  // deploy governace
  const timelock = await deployContract(wallet, Timelock, [AddressZero, 7 * 24 * 60 * 60])
  const govToken = await deployContract(wallet, WSGov, [wallet.address, wallet.address, nextMint], overrides)
  const governor = await deployContract(wallet, GovernorAlpha, [timelock.address, govToken.address], overrides)
  await timelock.initiateAdmin(governor.address)


  // deploy Controller
  const factoryLogic = await deployContract(wallet, WSFactory, [], overrides)
  const pairLogic = await deployContract(wallet, WSPair, [], overrides)
  const routerLogic = await deployContract(wallet, WSRouter, [], overrides)

  const controller = await deployContract(wallet, WSController, [pairLogic.address], overrides)
  await controller.transferOwnership(timelock.address)

  // deploy factory
  const factoryProxy = await deployContract(wallet, WSProxyFactory, [], overrides)
  await factoryProxy.initialize(factoryLogic.address, timelock.address, [])
  const factory = new Contract(factoryProxy.address, factoryLogic.interface, wallet)
  await factory.initialize(timelock.address, controller.address)

  // deploy router
  const routerProxy = await deployContract(wallet, WSProxyRouter, [], overrides)
  await routerProxy.initialize(routerLogic.address, timelock.address, [])
  const router = new Contract(routerProxy.address, routerLogic.interface, wallet)
  await router.initialize(factory.address, WETH.address)

  // deploy escrow
  const escrow = await deployContract(wallet, Escrow, [govToken.address])

  // create test pair
  await factory.createPair(token0.address, token1.address, overrides)
  const pairAddress = await factory.getPair(token0.address, token1.address)
  const pair = new Contract(pairAddress, JSON.stringify(IWSPair.abi), provider).connect(wallet)
  const pairToken = new Contract(pairAddress, JSON.stringify(IWSERC20.abi), provider).connect(wallet)

  // create test pair with WETH
  await factory.createPair(WETH.address, token0.address, overrides)
  const WETHPairAddress = await factory.getPair(WETH.address, token0.address)
  const WETHPair = new Contract(WETHPairAddress, JSON.stringify(IWSPair.abi), provider).connect(wallet)
  const WETHPairToken = new Contract(WETHPairAddress, JSON.stringify(IWSERC20.abi), provider).connect(wallet)

  return {
    govToken,
    governor,
    timelock,
    escrow,
    token0,
    token1,
    WETH,
    factory,
    router,
    pair,
    pairToken,
    WETHPair,
    WETHPairToken,
    factoryLogic,
    pairLogic,
    routerLogic,
    controller,
    updateContract,
    updatePairContract
  }

}

const NUMBER_OF_STAKING_TOKENS = 4

interface StakingRewardsFixture {
  stakingRewards: Contract
  rewardsToken: Contract
  stakingToken: Contract
}

export async function stakingRewardsFixture([wallet]: Wallet[]): Promise<StakingRewardsFixture> {
  const rewardsDistribution = wallet.address
  const rewardsToken = await deployContract(wallet, ERC20, [expandTo18Decimals(1000000)])
  const stakingToken = await deployContract(wallet, ERC20, [expandTo18Decimals(1000000)])

  const stakingRewards = await deployContract(wallet, StakingRewards, [
    rewardsDistribution,
    rewardsToken.address,
    stakingToken.address,
  ])

  return { stakingRewards, rewardsToken, stakingToken }
}

interface StakingRewardsFactoryFixture {
  rewardsToken: Contract
  stakingTokens: Contract[]
  genesis: number
  rewardAmounts: BigNumber[]
  stakingRewardsFactory: Contract
}

export async function stakingRewardsFactoryFixture(
  [wallet]: Wallet[],
  provider: Web3Provider
): Promise<StakingRewardsFactoryFixture> {
  const rewardsToken = await deployContract(wallet, ERC20, [expandTo18Decimals(1_000_000_000)])

  // deploy staking tokens
  const stakingTokens = []
  for (let i = 0; i < NUMBER_OF_STAKING_TOKENS; i++) {
    const stakingToken = await deployContract(wallet, ERC20, [expandTo18Decimals(1_000_000_000)])
    stakingTokens.push(stakingToken)
  }

  // deploy the staking rewards factory
  const { timestamp: now } = await provider.getBlock('latest')
  const genesis = now + 60 * 60
  const rewardAmounts: BigNumber[] = new Array(stakingTokens.length).fill(expandTo18Decimals(10))
  const stakingRewardsFactory = await deployContract(wallet, StakingRewardsFactory, [rewardsToken.address, genesis])

  return { rewardsToken, stakingTokens, genesis, rewardAmounts, stakingRewardsFactory }
}
