import chai, { expect } from 'chai'
import { Contract, BigNumber } from 'ethers'
import { keccak256 } from '@ethersproject/keccak256'
import { defaultAbiCoder } from '@ethersproject/abi'
import { mineBlock, minerStop, minerStart, getDelegateDigest } from './shared/utilities'
import { solidity, MockProvider, createFixtureLoader } from 'ethereum-waffle'
import { AddressZero } from '@ethersproject/constants'
import { ecsign } from 'ethereumjs-util'

import { govFixture } from './shared/fixtures'

chai.use(solidity)

const overrides = {
  gasLimit: 9999999
}

describe('GovToken', async () => {
  const name = 'WSGov'
  const symbol = 'WSE'
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 9999999
    }
  })
  const [root, a1, a2, guy] = provider.getWallets()
  const loadFixture = createFixtureLoader([root], provider)

  let govToken: Contract
  beforeEach(async () => {
    const fixture = await loadFixture(govFixture)
    govToken = fixture.govToken
  })

  describe('metadata', async () => {
    it('has given name', async () => {
      expect(await govToken.name()).to.eq(name)
    })

    it('has given symbol', async () => {
      expect(await govToken.symbol()).to.eq(symbol)
    })
  })

  describe('balanceOf', async () => {
    it('grants to initial account', async () => {
      expect(await govToken.balanceOf(root.address)).to.eq('1000000000000000000000000000')
    })
  })

  describe('delegateBySig', () => {
    it('reverts if the signatory is invalid', async () => {
      const delegatee = root.address
      const nonce = BigNumber.from(0)
      const expiry = BigNumber.from(0)
      await expect(
        govToken.delegateBySig(
          delegatee,
          nonce,
          expiry,
          0,
          '0xc7826f1fe753c62a24cc021b35c222e29f1931dbdfe14bcce011fd7b9d213f6f',
          '0xc7826f1fe753c62a24cc021b35c222e29f1931dbdfe14bcce011fd7b9d213f6f'
        )
      ).to.be.revertedWith('WSG::delegateBySig: invalid signature')
    })

    it('reverts if the nonce is bad ', async () => {
      const delegatee = root.address
      const nonce = BigNumber.from(1)
      const expiry = BigNumber.from(10e9)
      const digest = await getDelegateDigest(govToken, { delegatee, expiry }, nonce)
      const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(a1.privateKey.slice(2), 'hex'))
      await expect(govToken.delegateBySig(delegatee, nonce, expiry, v, r, s)).to.be.revertedWith(
        'WSG::delegateBySig: invalid nonce'
      )
    })

    it('reverts if the signature has expired', async () => {
      const delegatee = root.address
      const nonce = BigNumber.from(0)
      const expiry = BigNumber.from(0)
      const digest = await getDelegateDigest(govToken, { delegatee, expiry }, nonce)
      const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(a1.privateKey.slice(2), 'hex'))
      await expect(govToken.delegateBySig(delegatee, nonce, expiry, v, r, s)).to.be.revertedWith(
        'WSG::delegateBySig: signature expired'
      )
    })

    it('delegates on behalf of the signatory', async () => {
      const delegatee = root.address
      const nonce = BigNumber.from(0)
      const expiry = BigNumber.from(10e9)
      const digest = await getDelegateDigest(govToken, { delegatee, expiry }, nonce)
      const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(a1.privateKey.slice(2), 'hex'))

      expect(await govToken.delegates(a1.address)).to.eq(AddressZero)
      const tx = await govToken.delegateBySig(delegatee, nonce, expiry, v, r, s)
      expect(tx.gasUsed < 80000)
      expect(await govToken.delegates(a1.address)).to.eq(root.address)
    })
  })

  async function expectCheckpoint(address: String, index: Number, _blockNumber: BigNumber, _votes: BigNumber) {
    const [blockNumber, votes] = await govToken.callStatic.checkpoints(address, index)
    expect(blockNumber).to.eq(_blockNumber)
    expect(votes).to.eq(_votes)
  }

  async function getTxBlockNumber(tx_hash: string): Promise<number> {
    return (await provider.getTransactionReceipt(tx_hash)).blockNumber
  }

  describe('numCheckpoints', async () => {
    async function afterEach() {
      await minerStart(provider)
    }

    it('does not add more than one checkpoint in a block', async () => {
      const govTokenGuy = govToken.connect(guy)
      await govToken.transfer(guy.address, 100)

      expect(await govToken.callStatic.numCheckpoints(a1.address)).to.eq(0)

      await minerStop(provider)
      await govTokenGuy.delegate(a1.address, { gasLimit: 99999, nonce: 0 })
      await govTokenGuy.transfer(a1.address, 10, { gasLimit: 99999, nonce: 1 })
      await govTokenGuy.transfer(a1.address, 10, { gasLimit: 99999, nonce: 2 })
      await mineBlock(provider)
      const checkpoint_block = await provider.getBlockNumber()
      await minerStart(provider)

      expect(await govToken.callStatic.numCheckpoints(a1.address)).to.eq(1)
      await expectCheckpoint(a1.address, 0, BigNumber.from(checkpoint_block), BigNumber.from(80))
      await expectCheckpoint(a1.address, 1, BigNumber.from(0), BigNumber.from(0))
      await expectCheckpoint(a1.address, 2, BigNumber.from(0), BigNumber.from(0))

      const t1 = await govToken.transfer(guy.address, 20)
      const checkpoint_block_2 = await getTxBlockNumber(t1.hash)
      expect(await govToken.callStatic.numCheckpoints(a1.address)).to.eq(2)
      await expectCheckpoint(a1.address, 1, BigNumber.from(checkpoint_block_2), BigNumber.from(100))
    })

    it('returns the number of checkpoints for a delegate', async () => {
      const govTokenGuy = govToken.connect(guy)
      await govToken.transfer(guy.address, 100)

      expect(await govToken.numCheckpoints(a1.address)).to.eq(0)
      await govTokenGuy.delegate(a1.address)
      const checkpoint_block_1 = await provider.getBlockNumber()
      expect(await govToken.numCheckpoints(a1.address)).to.eq(1)

      await govTokenGuy.transfer(a2.address, 10)
      const checkpoint_block_2 = await provider.getBlockNumber()
      expect(await govToken.numCheckpoints(a1.address)).to.eq(2)

      await govTokenGuy.transfer(a2.address, 10)
      const checkpoint_block_3 = await provider.getBlockNumber()
      expect(await govToken.numCheckpoints(a1.address)).to.eq(3)

      await govToken.transfer(guy.address, 20)
      const checkpoint_block_4 = await provider.getBlockNumber()
      expect(await govToken.numCheckpoints(a1.address)).to.eq(4)

      await expectCheckpoint(a1.address, 0, BigNumber.from(checkpoint_block_1), BigNumber.from(100))
      await expectCheckpoint(a1.address, 1, BigNumber.from(checkpoint_block_2), BigNumber.from(90))
      await expectCheckpoint(a1.address, 2, BigNumber.from(checkpoint_block_3), BigNumber.from(80))
      await expectCheckpoint(a1.address, 3, BigNumber.from(checkpoint_block_4), BigNumber.from(100))
    })
  })

  describe('getPriorVotes', () => {
    it('reverts if block number >= current block', async () => {
      await expect(govToken.getPriorVotes(a1.address, 5e10)).to.be.revertedWith(
        'WSG::getPriorVotes: not yet determined'
      )
    })

    it('returns 0 if there are no checkpoints', async () => {
      expect(await govToken.getPriorVotes(a1.address, 0)).to.eq(0)
    })

    it('returns the latest block if >= last checkpoint block', async () => {
      const t1 = await govToken.delegate(a1.address)
      await mineBlock(provider)
      await mineBlock(provider)
      const block_number = await getTxBlockNumber(t1.hash)

      expect(await govToken.getPriorVotes(a1.address, block_number)).to.eq('1000000000000000000000000000')
      expect(await govToken.getPriorVotes(a1.address, block_number + 1)).to.eq('1000000000000000000000000000')
    })

    it('returns zero if < first checkpoint block', async () => {
      await mineBlock(provider)
      const t1 = await govToken.delegate(a1.address)
      await mineBlock(provider)
      await mineBlock(provider)

      const block_number = await getTxBlockNumber(t1.hash)
      expect(await govToken.getPriorVotes(a1.address, block_number - 1)).to.eq('0')
      expect(await govToken.getPriorVotes(a1.address, block_number + 1)).to.eq('1000000000000000000000000000')
    })

    it('generally returns the voting balance at the appropriate checkpoint', async () => {
      const govTokenA2 = govToken.connect(a2)

      const t1 = await govToken.delegate(a1.address)
      await mineBlock(provider)
      await mineBlock(provider)
      const t2 = await govToken.transfer(a2.address, 10)
      await mineBlock(provider)
      await mineBlock(provider)
      const t3 = await govToken.transfer(a2.address, 10)
      await mineBlock(provider)
      await mineBlock(provider)
      const t4 = await govTokenA2.transfer(root.address, 20)
      await mineBlock(provider)
      await mineBlock(provider)

      const bn1 = await getTxBlockNumber(t1.hash)
      const bn2 = await getTxBlockNumber(t2.hash)
      const bn3 = await getTxBlockNumber(t3.hash)
      const bn4 = await getTxBlockNumber(t4.hash)

      expect(await govToken.getPriorVotes(a1.address, bn1 - 1)).to.eq('0')
      expect(await govToken.getPriorVotes(a1.address, bn1)).to.eq('1000000000000000000000000000')
      expect(await govToken.getPriorVotes(a1.address, bn1 + 1)).to.eq('1000000000000000000000000000')

      expect(await govToken.getPriorVotes(a1.address, bn2)).to.eq('999999999999999999999999990')
      expect(await govToken.getPriorVotes(a1.address, bn2 + 1)).to.eq('999999999999999999999999990')

      expect(await govToken.getPriorVotes(a1.address, bn3)).to.eq('999999999999999999999999980')
      expect(await govToken.getPriorVotes(a1.address, bn3 + 1)).to.eq('999999999999999999999999980')

      expect(await govToken.getPriorVotes(a1.address, bn4)).to.eq('1000000000000000000000000000')
      expect(await govToken.getPriorVotes(a1.address, bn4 + 1)).to.eq('1000000000000000000000000000')
    })
  })

  describe('mint', async () => {
    it('mint not allowed before expected minting time', async () => {
      await expect(govToken.mint(a2.address, 1)).to.be.revertedWith('WSG::mint: minting not allowed yet')
    })

    it('mint not allowed by not minter', async () => {
      const govTokenA2 = govToken.connect(a2)
      await mineBlock(provider, Math.round(Date.now() / 1000) + 365 * 24 * 60 * 60)
      await expect(govTokenA2.mint(a2.address, 1)).to.be.revertedWith('WSG::mint: only the minter can mint')
    })

    it('mint not allowed more then 2%', async () => {
      await mineBlock(provider, Math.round(Date.now() / 1000) + 365 * 24 * 60 * 60)
      await expect(
        govToken.mint(
          a2.address,
          (await govToken.totalSupply())
            .mul(2)
            .div(100)
            .add(1)
        )
      ).to.be.revertedWith('WSG::mint: exceeded mint cap')
    })

    it('mint success', async () => {
      expect(await govToken.balanceOf(a2.address)).to.eq(0)
      await mineBlock(provider, Math.round(Date.now() / 1000) + 365 * 24 * 60 * 60)

      const initTotalSupply = await govToken.totalSupply()
      const mintAmount = initTotalSupply.mul(2).div(100)
      await govToken.mint(a2.address, mintAmount)
      expect(await govToken.balanceOf(a2.address)).to.eq(mintAmount)
      expect(await govToken.totalSupply()).to.eq(initTotalSupply.add(mintAmount))
    })
  })

  describe('set minter', async () => {
    it('set is not allowed by not a minter', async () => {
      const govTokenA2 = govToken.connect(a2)
      await expect(govTokenA2.setMinter(a2.address)).to.be.revertedWith(
        'WSG::setMinter: only the minter can change the minter address'
      )
    })

    it('set success', async () => {
      expect(await govToken.minter()).to.eq(root.address)
      await govToken.setMinter(a2.address)
      expect(await govToken.minter()).to.eq(a2.address)
    })
  })
})
