import chai, { expect } from 'chai'
import { Contract, BigNumber } from 'ethers'
import { keccak256 } from '@ethersproject/keccak256'
import { defaultAbiCoder } from '@ethersproject/abi'
import { expandTo18Decimals, mineBlock, getCurrentTimestamp, getProxyInterface } from './shared/utilities'
import { solidity, MockProvider, createFixtureLoader } from 'ethereum-waffle'
import { AddressZero } from '@ethersproject/constants'
import { ecsign } from 'ethereumjs-util'
import { pack as solidityPack } from '@ethersproject/solidity'

import { IntegrationFixture } from './shared/fixtures'

import IWSUpdate from '../build/IWSUpdate.json'

chai.use(solidity)

const overrides = {
  gasLimit: 9999999
}

const UPDATE_ID = 360894
const INITIALIZE_ID = 4355

describe('Integration', async () => {
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 9999999
    }
  })
  const [wallet, a1, a2] = provider.getWallets()
  const loadFixture = createFixtureLoader([wallet], provider)

  let govToken: Contract
  let governor: Contract
  let timelock: Contract
  let escrow: Contract
  let token0: Contract
  let token1: Contract
  let WETH: Contract
  let factory: Contract
  let router: Contract
  let pair: Contract
  let pairToken: Contract
  let WETHPair: Contract
  let WETHPairToken: Contract
  let factoryLogic:Contract
  let pairLogic:Contract
  let routerLogic: Contract
  let controller: Contract
  let updateContract: Contract
  let updatePairContract: Contract
  beforeEach(async () => {
    const fixture = await loadFixture(IntegrationFixture)
    govToken = fixture.govToken
    governor = fixture.governor
    timelock = fixture.timelock
    escrow = fixture.escrow
    token0 = fixture.token0
    token1 = fixture.token1
    WETH = fixture.WETH
    factory = fixture.factory
    router = fixture.router
    pair = fixture.pair
    pairToken = fixture.pairToken
    WETHPair = fixture.WETHPair
    WETHPairToken = fixture.WETHPairToken
    factoryLogic = fixture.factoryLogic
    pairLogic = fixture.pairLogic
    routerLogic = fixture.routerLogic
    controller = fixture.controller
    updateContract = fixture.updateContract
    updatePairContract = fixture.updatePairContract
  })

  async function executePropolsal(proposalId: number, gov: Contract) {
    await mineBlock(provider)
    await gov.castVote(proposalId, true)
    await mineBlock(provider, getCurrentTimestamp() + 604_810)

    await gov.queue(proposalId)
    let proposal = await gov.proposals(proposalId)
    let eta = proposal.eta
    await mineBlock(
      provider,
      eta
        .add(1)
        .toNumber()
    )
    await gov.execute(proposalId)
  }

  describe('Admin update', async () => {
    it('Router admin update', async () => {
      await govToken.delegate(wallet.address)
      await mineBlock(provider)
      await governor.propose(
        [router.address],
        [expandTo18Decimals(0)],
        ['changeAdmin(address)'],
        [defaultAbiCoder.encode(['address'],
        [wallet.address])],
        'change admin'
      )
      let proposalId = await governor.callStatic.latestProposalIds(wallet.address)
      await executePropolsal(proposalId, governor)

      let routerProxy = getProxyInterface(router.address, wallet, provider)
      expect(await routerProxy.callStatic.admin()).to.eq(wallet.address)
    })

    it('Factory admin update', async () => {
      await govToken.delegate(wallet.address)
      await mineBlock(provider)
      await governor.propose(
        [factory.address],
        [expandTo18Decimals(0)],
        ['changeAdmin(address)'],
        [defaultAbiCoder.encode(['address'],
        [wallet.address])],
        'change admin'
      )
      let proposalId = await governor.callStatic.latestProposalIds(wallet.address)
      await executePropolsal(proposalId, governor)

      let factoryProxy = getProxyInterface(factory.address, wallet, provider)

      expect(await factoryProxy.callStatic.admin()).to.eq(wallet.address)
    })

    it('Pair admin update', async () => {
      await govToken.delegate(wallet.address)
      await mineBlock(provider)
      await governor.propose(
        [controller.address],
        [expandTo18Decimals(0)],
        ['updateCurrentAdmin(address)'],
        [defaultAbiCoder.encode(['address'],
        [wallet.address])],
        'change admin'
      )
      let proposalId = await governor.callStatic.latestProposalIds(wallet.address)
      await executePropolsal(proposalId, governor)

      await controller.setAdminForProxy(pair.address)
      let pairProxy = getProxyInterface(pair.address, wallet, provider)
      expect(await pairProxy.callStatic.admin()).to.eq(wallet.address)
    })
  })

  describe('Update logic', async () => {
    it('Update router logic', async () => {
      await govToken.delegate(wallet.address)
      await mineBlock(provider)
      await governor.propose(
        [router.address],
        [expandTo18Decimals(0)],
        ['upgradeTo(address)'],
        [defaultAbiCoder.encode(['address'],
        [updateContract.address])],
        'update logic'
      )
      let proposalId = await governor.callStatic.latestProposalIds(wallet.address)
      await executePropolsal(proposalId, governor)

      let updatedRouter = new Contract(router.address, JSON.stringify(IWSUpdate.abi), provider).connect(wallet)

      expect(await updatedRouter.callStatic.isUpdated()).to.eq(UPDATE_ID)
    })

    it('Update factory logic', async () => {
      await govToken.delegate(wallet.address)
      await mineBlock(provider)
      await governor.propose(
        [factory.address],
        [expandTo18Decimals(0)],
        ['upgradeTo(address)'],
        [defaultAbiCoder.encode(['address'],
        [updateContract.address])],
        'update logic'
      )
      let proposalId = await governor.callStatic.latestProposalIds(wallet.address)
      await executePropolsal(proposalId, governor)

      let updatedFactory = new Contract(factory.address, JSON.stringify(IWSUpdate.abi), provider).connect(wallet)

      expect(await updatedFactory.callStatic.isUpdated()).to.eq(UPDATE_ID)
    })

    it('Update pair logic', async () => {
      await govToken.delegate(wallet.address)
      await mineBlock(provider)
      await governor.propose(
        [controller.address],
        [expandTo18Decimals(0)],
        ['updatePairLogic(address)'],
        [defaultAbiCoder.encode(['address'],
        [updateContract.address])],
        'update logic'
      )
      let proposalId = await governor.callStatic.latestProposalIds(wallet.address)
      await executePropolsal(proposalId, governor)
      await controller.updateProxyPair(pair.address)

      let updatedPair = new Contract(pair.address, JSON.stringify(IWSUpdate.abi), provider).connect(wallet)

      expect(await updatedPair.callStatic.isUpdated()).to.eq(UPDATE_ID)
    })
  })

  describe('Update logic with initialization', async () => {
    it('Update router', async () => {
      await govToken.delegate(wallet.address)
      await mineBlock(provider)
      await governor.propose(
        [router.address],
        [expandTo18Decimals(0)],
        ['upgradeToAndCall(address,bytes)'],
        [defaultAbiCoder.encode(['address', 'bytes'],
        [updateContract.address, solidityPack(['bytes4', 'uint256'],[Buffer.from('fe4b84df', 'hex'), INITIALIZE_ID])])],
        'update logic'
      )
      let proposalId = await governor.callStatic.latestProposalIds(wallet.address)
      await executePropolsal(proposalId, governor)

      let updatedRouter = new Contract(router.address, JSON.stringify(IWSUpdate.abi), provider).connect(wallet)

      expect(await updatedRouter.callStatic.isUpdated()).to.eq(UPDATE_ID)
      expect(await updatedRouter.callStatic.getUpdateValue()).to.eq(INITIALIZE_ID)
    })

    it('Update factory', async () => {
      await govToken.delegate(wallet.address)
      await mineBlock(provider)
      await governor.propose(
        [factory.address],
        [expandTo18Decimals(0)],
        ['upgradeToAndCall(address,bytes)'],
        [defaultAbiCoder.encode(['address', 'bytes'],
        [updateContract.address, solidityPack(['bytes4', 'uint256'],[Buffer.from('fe4b84df', 'hex'), INITIALIZE_ID])])],
        'update logic'
      )
      let proposalId = await governor.callStatic.latestProposalIds(wallet.address)
      await executePropolsal(proposalId, governor)

      let updatedFactory = new Contract(factory.address, JSON.stringify(IWSUpdate.abi), provider).connect(wallet)

      expect(await updatedFactory.callStatic.isUpdated()).to.eq(UPDATE_ID)
      expect(await updatedFactory.callStatic.getUpdateValue()).to.eq(INITIALIZE_ID)
    })
  })

  describe('Treasury', async () => {
    it('Governer can get tokens and send', async () => {
      await govToken.delegate(wallet.address)
      await mineBlock(provider)
      const escrowTime = Math.round(Date.now() / 1000) + 3
      await govToken.transfer(escrow.address, expandTo18Decimals(2))
      await escrow.appendVestingEntry(
        timelock.address,
        escrowTime,
        expandTo18Decimals(2)
      )

      await governor.propose(
        [escrow.address, govToken.address],
        [expandTo18Decimals(0), expandTo18Decimals(0)],
        ['vest()', 'transfer(address,uint256)'],
        [[], defaultAbiCoder.encode(['address', 'uint256'],
        [a1.address, expandTo18Decimals(1)])],
        'get vesting and transfer to'
      )
      let proposalId = await governor.callStatic.latestProposalIds(wallet.address)
      await executePropolsal(proposalId, governor)

      expect(await govToken.balanceOf(a1.address)).to.eq(expandTo18Decimals(1))
    })
  })

})