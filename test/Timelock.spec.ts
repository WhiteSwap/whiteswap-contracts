import chai, { expect } from 'chai'
import { Contract, BigNumber } from 'ethers'
import { keccak256 } from '@ethersproject/keccak256'
import { defaultAbiCoder } from '@ethersproject/abi'
import { pack as solidityPack } from '@ethersproject/solidity'
import { mineBlock } from './shared/utilities'
import { solidity, MockProvider, createFixtureLoader } from 'ethereum-waffle'
import { AddressZero } from '@ethersproject/constants'

import { TimelockFixture } from './shared/fixtures'

chai.use(solidity)

const overrides = {
  gasLimit: 9999999
}

const oneWeekInSeconds = BigNumber.from(7 * 24 * 60 * 60)
const zero = BigNumber.from(0)
const gracePeriod = oneWeekInSeconds.mul(2)

describe('Timelock', () => {
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 9999999
    }
  })
  const [root, notAdmin, newAdmin] = provider.getWallets()
  const loadFixture = createFixtureLoader([root], provider)

  let blockTimestamp: BigNumber
  let timelock: Contract
  let delay = oneWeekInSeconds
  let newDelay = delay.mul(2)
  let target: String
  let value = zero
  let signature = 'setDelay(uint256)'
  let data = defaultAbiCoder.encode(['uint256'], [newDelay])
  let revertData = defaultAbiCoder.encode(['uint256'], [BigNumber.from(60 * 60)])
  let eta: BigNumber
  let queuedTxHash: String

  beforeEach(async () => {
    const fixture = await loadFixture(TimelockFixture)
    timelock = fixture.timelock
    data = defaultAbiCoder.encode(['uint256'], [newDelay])
    blockTimestamp = BigNumber.from(Math.floor(Date.now() / 1000))
    target = timelock.address
    eta = blockTimestamp.add(delay).add(1)

    queuedTxHash = keccak256(
      defaultAbiCoder.encode(
        ['address', 'uint256', 'string', 'bytes', 'uint256'],
        [target, value, signature, data, eta]
      )
    )
  })

  describe('constructor', async () => {
    it('sets address of admin', async () => {
      expect(await timelock.admin()).to.eq(root.address)
    })

    it('sets delay', async () => {
      expect(await timelock.delay()).to.eq(delay.toString())
    })
  })

  describe('setDelay', () => {
    it('requires msg.sender to be Timelock', async () => {
      await expect(timelock.setDelay(delay)).to.be.revertedWith('Timelock::setDelay: Call must come from Timelock.')
    })
  })

  describe('setPendingAdmin', () => {
    it('requires msg.sender to be Timelock', async () => {
      await expect(timelock.setPendingAdmin(newAdmin.address)).to.be.revertedWith(
        'Timelock::setPendingAdmin: Call must come from Timelock.'
      )
    })
  })

  describe('acceptAdmin', () => {
    it('requires msg.sender to be pendingAdmin', async () => {
      await expect(timelock.acceptAdmin()).to.be.revertedWith(
        'Timelock::acceptAdmin: Call must come from pendingAdmin.'
      )
    })
  })

  describe('queueTransaction', () => {
    it('requires admin to be msg.sender', async () => {
      const timelockNotAdmin = timelock.connect(notAdmin)
      await expect(timelockNotAdmin.queueTransaction(target, value, signature, data, eta)).to.be.revertedWith(
        'Timelock::queueTransaction: Call must come from admin.'
      )
    })

    it('requires eta to exceed delay', async () => {
      const etaLessThanDelay = blockTimestamp.add(delay).sub(1)
      await expect(timelock.queueTransaction(target, value, signature, data, etaLessThanDelay)).to.be.revertedWith(
        'Timelock::queueTransaction: Estimated execution block must satisfy delay.'
      )
    })

    it('sets hash as true in queuedTransactions mapping', async () => {
      expect(await timelock.callStatic.queuedTransactions(queuedTxHash)).to.eq(false)
      await timelock.queueTransaction(target, value, signature, data, eta)

      await timelock.queueTransaction(target, value, signature, data, eta)
      expect(await timelock.callStatic.queuedTransactions(queuedTxHash)).to.eq(true)
    })

    it('should emit QueueTransaction event', async () => {
      await expect(timelock.queueTransaction(target, value, signature, data, eta))
        .to.emit(timelock, 'QueueTransaction')
        .withArgs(queuedTxHash, target, value, signature, data, eta)
    })
  })

  describe('cancelTransaction', () => {
    beforeEach(async () => {
      await timelock.queueTransaction(target, value, signature, data, eta, overrides)
    })

    it('requires admin to be msg.sender', async () => {
      const timelockNotAdmin = timelock.connect(notAdmin)
      await expect(timelockNotAdmin.cancelTransaction(target, value, signature, data, eta)).to.be.revertedWith(
        'Timelock::cancelTransaction: Call must come from admin.'
      )
    })

    it('sets hash from true to false in queuedTransactions mapping', async () => {
      expect(await timelock.queuedTransactions(queuedTxHash)).to.eq(true)
      await timelock.cancelTransaction(target, value, signature, data, eta)
      expect(await timelock.queuedTransactions(queuedTxHash)).to.eq(false)
    })

    it('should emit CancelTransaction event', async () => {
      await expect(timelock.cancelTransaction(target, value, signature, data, eta))
        .to.emit(timelock, 'CancelTransaction')
        .withArgs(queuedTxHash, target, value, signature, data, eta)
    })
  })

  describe('queue and cancel empty', () => {
    it('can queue and cancel an empty signature and data', async () => {
      const txHash = keccak256(
        defaultAbiCoder.encode(['address', 'uint256', 'string', 'bytes', 'uint256'], [target, value, '', '0x', eta])
      )
      expect(await timelock.callStatic.queuedTransactions(txHash)).to.eq(false)
      await timelock.queueTransaction(target, value, '', '0x', eta)
      expect(await timelock.callStatic.queuedTransactions(txHash)).to.eq(true)
      await timelock.cancelTransaction(target, value, '', '0x', eta)
      expect(await timelock.callStatic.queuedTransactions(txHash)).to.eq(false)
    })
  })

  describe('executeTransaction (setDelay)', () => {
    beforeEach(async () => {
      // Queue transaction that will succeed
      await timelock.queueTransaction(target, value, signature, data, eta)

      // Queue transaction that will revert when executed
      await timelock.queueTransaction(target, value, signature, revertData, eta)
    })

    it('requires admin to be msg.sender', async () => {
      const timelockNotAdmin = timelock.connect(notAdmin)
      await expect(timelockNotAdmin.executeTransaction(target, value, signature, data, eta)).to.be.revertedWith(
        'Timelock::executeTransaction: Call must come from admin.'
      )
    })

    it('requires timestamp to be greater than or equal to eta', async () => {
      await expect(timelock.executeTransaction(target, value, signature, data, eta)).to.be.revertedWith(
        "Timelock::executeTransaction: Transaction hasn't surpassed time lock."
      )
    })

    it('requires timestamp to be less than eta plus gracePeriod', async () => {
      await mineBlock(
        provider,
        blockTimestamp
          .add(delay)
          .add(gracePeriod)
          .add(101)
          .toNumber()
      )
      await expect(timelock.executeTransaction(target, value, signature, data, eta)).to.be.revertedWith(
        'Timelock::executeTransaction: Transaction is stale.'
      )
    })

    it('requires target.call transaction to succeed', async () => {
      await mineBlock(provider, eta.toNumber())
      await expect(timelock.executeTransaction(target, value, signature, revertData, eta)).to.be.revertedWith(
        'Timelock::executeTransaction: Transaction execution reverted.'
      )
    })

    it('sets hash from true to false in queuedTransactions mapping, updates delay, and emits ExecuteTransaction event', async () => {
      expect(await timelock.callStatic.delay()).to.eq(delay.toString())
      expect(await timelock.callStatic.queuedTransactions(queuedTxHash)).to.eq(true)

      const newBlockTimestamp = blockTimestamp.add(delay).add(1)
      await mineBlock(provider, newBlockTimestamp.toNumber())

      await expect(timelock.executeTransaction(target, value, signature, data, eta))
        .to.emit(timelock, 'ExecuteTransaction')
        .withArgs(queuedTxHash, target, value, signature, data, eta)
        .to.emit(timelock, 'NewDelay')
        .withArgs(newDelay.toString())

      expect(await timelock.callStatic.queuedTransactions(queuedTxHash)).to.eq(false)
      expect(await timelock.callStatic.delay()).to.eq(newDelay.toString())
    })
  })

  describe('executeTransaction (setPendingAdmin)', () => {
    beforeEach(async () => {
      const configuredDelay = await timelock.callStatic.delay()
      delay = BigNumber.from(configuredDelay)

      signature = 'setPendingAdmin(address)'
      data = defaultAbiCoder.encode(['address'], [newAdmin.address])
      eta = blockTimestamp.add(delay)

      queuedTxHash = keccak256(
        defaultAbiCoder.encode(
          ['address', 'uint256', 'string', 'bytes', 'uint256'],
          [target, value, signature, data, eta]
        )
      )
      await timelock.queueTransaction(target, value, signature, data, eta)
    })

    it('sets hash from true to false in queuedTransactions mapping, updates admin, and emits ExecuteTransaction event', async () => {
      expect(await timelock.callStatic.pendingAdmin()).to.eq(AddressZero)
      expect(await timelock.queuedTransactions(queuedTxHash)).to.eq(true)

      const newBlockTimestamp = blockTimestamp.add(delay).add(1)
      await mineBlock(provider, newBlockTimestamp.toNumber())
      await expect(timelock.executeTransaction(target, value, signature, data, eta))
        .to.emit(timelock, 'ExecuteTransaction')
        .withArgs(queuedTxHash, target, value, signature, data, eta)
        .to.emit(timelock, 'NewPendingAdmin')
        .withArgs(newAdmin.address)

      expect(await timelock.queuedTransactions(queuedTxHash)).to.eq(false)
      expect(await timelock.callStatic.pendingAdmin()).to.eq(newAdmin.address)
    })
  })
})
