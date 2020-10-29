import chai, { expect } from 'chai'
import { Contract, BigNumber } from 'ethers'
import { mineBlock, expandTo18Decimals } from './shared/utilities'
import { solidity, MockProvider, createFixtureLoader } from 'ethereum-waffle'

import { EscrowFixture } from './shared/fixtures'

chai.use(solidity)

const overrides = {
  gasLimit: 9999999
}

const DAY = 86400
const WEEK = 604800
const YEAR = 31556926

function currentTime(): number {
  return Math.round(Date.now() / 1000)
}

function getYearFromNow(): number {
  const timestamp = currentTime()
  return timestamp + YEAR
}

function weeksFromNow(weeks: number): number {
  const timestamp = currentTime()
  return timestamp + WEEK * weeks
}

describe('Escrow', async () => {
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 9999999
    }
  })
  const [owner, account1, account2] = provider.getWallets()
  const loadFixture = createFixtureLoader([owner], provider)

  let token: Contract
  let escrow: Contract
  beforeEach(async () => {
    const fixture = await loadFixture(EscrowFixture)
    token = fixture.token
    escrow = fixture.escrow
  })

  describe('Constructor & Settings', async () => {
    it('should set token on contructor', async () => {
      expect(await escrow.token()).to.eq(token.address)
    })

    it('should set owner on contructor', async () => {
      expect(await escrow.owner()).to.eq(owner.address)
    })
  })

  describe('Only During Setup', async () => {
    it('should allow owner to purgeAccount', async () => {
      const vestAmount = expandTo18Decimals(1000)
      await token.transfer(escrow.address, vestAmount)
      await escrow.appendVestingEntry(account1.address, getYearFromNow(), vestAmount)

      expect(await escrow.numVestingEntries(account1.address)).to.eq(1)
      expect(await escrow.totalVestedAccountBalance(account1.address)).to.eq(vestAmount)

      await escrow.purgeAccount(account1.address)

      expect(await escrow.numVestingEntries(account1.address)).to.eq(0)
      expect(await escrow.totalVestedAccountBalance(account1.address)).to.eq(0)
    })

    it('should allow owner to call addVestingSchedule', async () => {
      await token.transfer(escrow.address, expandTo18Decimals(200))
      const times = [weeksFromNow(1), weeksFromNow(2)]
      const quantities = [expandTo18Decimals(100), expandTo18Decimals(100)]

      await escrow.addVestingSchedule(account1.address, times, quantities)

      expect(await escrow.numVestingEntries(account1.address)).to.eq(2)
      expect(await escrow.totalVestedAccountBalance(account1.address)).to.eq(expandTo18Decimals(200))

      expect(await escrow.getVestingTime(account1.address, 0)).to.eq(times[0])
      expect(await escrow.getVestingTime(account1.address, 1)).to.eq(times[1])
    })
  })

  describe('Given there are no escrow entries', async () => {
    it('then numVestingEntries should return 0', async () => {
      expect(await escrow.numVestingEntries(account1.address)).to.eq(0)
    })

    it('then getNextVestingEntry should return 0', async () => {
      const nextVestingEntry = await escrow.callStatic.getNextVestingEntry(account1.address)
      expect(nextVestingEntry[0]).to.eq(0)
      expect(nextVestingEntry[1]).to.eq(0)
    })

    it('then calling vest should do nothing and not fail', async () => {
      const escrowA1 = escrow.connect(account1)
      await escrowA1.vest()
      expect(await escrow.totalVestedAccountBalance(account1.address)).to.eq(0)
    })
  })

  describe('Functions', async () => {
    describe('Vesting Schedule Writes', async () => {
      it('should not create a vesting entry with a zero amount', async () => {
        await token.transfer(escrow.address, expandTo18Decimals(1))
        await expect(escrow.appendVestingEntry(account1.address, getYearFromNow(), 0)).to.be.revertedWith(
          'Quantity cannot be zero'
        )
      })

      it('should not create a vesting entry if there is not enough tokens in the contracts balance', async () => {
        await token.transfer(escrow.address, expandTo18Decimals(1))
        await expect(
          escrow.appendVestingEntry(account1.address, getYearFromNow(), expandTo18Decimals(10))
        ).to.be.revertedWith('Must be enough balance in the contract to provide for the vesting entry')
      })
    })
    describe('Vesting Schedule Reads ', async () => {
      beforeEach(async () => {
        await token.transfer(escrow.address, expandTo18Decimals(6000))
        await escrow.appendVestingEntry(account1.address, getYearFromNow(), expandTo18Decimals(1000))

        await mineBlock(provider, weeksFromNow(1))
        await escrow.appendVestingEntry(account1.address, getYearFromNow() + 1, expandTo18Decimals(2000))
        await mineBlock(provider, weeksFromNow(2))

        await escrow.appendVestingEntry(account1.address, getYearFromNow() + 2, expandTo18Decimals(3000))
      })
      it('should append a vesting entry and increase the contracts balance', async () => {
        expect(await token.balanceOf(escrow.address)).to.eq(expandTo18Decimals(6000))
      })

      it('should get an accounts total Vested Account Balance', async () => {
        expect(await escrow.balanceOf(account1.address)).to.eq(expandTo18Decimals(6000))
      })

      it('should get an accounts number of vesting entries', async () => {
        expect(await escrow.numVestingEntries(account1.address)).to.eq(3)
      })

      it('should get an accounts vesting schedule entry by index', async () => {
        expect((await escrow.callStatic.getVestingScheduleEntry(account1.address, BigNumber.from(0)))[1]).to.eq(
          expandTo18Decimals(1000)
        )
        expect((await escrow.callStatic.getVestingScheduleEntry(account1.address, BigNumber.from(1)))[1]).to.eq(
          expandTo18Decimals(2000)
        )
        expect((await escrow.callStatic.getVestingScheduleEntry(account1.address, BigNumber.from(2)))[1]).to.eq(
          expandTo18Decimals(3000)
        )
      })

      it('should get an accounts vesting time for a vesting entry index', async () => {
        const oneYearAhead = getYearFromNow() - WEEK
        expect(await escrow.getVestingTime(account1.address, 0)).to.gte(oneYearAhead)
        expect(await escrow.getVestingTime(account1.address, 1)).to.gte(oneYearAhead)
        expect(await escrow.getVestingTime(account1.address, 2)).to.gte(oneYearAhead)
      })

      it('should get an accounts vesting quantity for a vesting entry index', async () => {
        expect(await escrow.getVestingQuantity(account1.address, 0)).to.eq(expandTo18Decimals(1000))
        expect(await escrow.getVestingQuantity(account1.address, 1)).to.eq(expandTo18Decimals(2000))
        expect(await escrow.getVestingQuantity(account1.address, 2)).to.eq(expandTo18Decimals(3000))
      })
    })

    describe('Partial Vesting', async () => {
      beforeEach(async () => {
        await token.transfer(escrow.address, expandTo18Decimals(6000))
        await escrow.appendVestingEntry(account1.address, getYearFromNow(), expandTo18Decimals(1000))
        await mineBlock(provider, weeksFromNow(1))
        await escrow.appendVestingEntry(account1.address, getYearFromNow() + WEEK, expandTo18Decimals(2000))
        await mineBlock(provider, weeksFromNow(2))
        await escrow.appendVestingEntry(account1.address, getYearFromNow() + 2 * WEEK, expandTo18Decimals(3000))

        await mineBlock(provider, getYearFromNow())

        const escrowA1 = escrow.connect(account1)
        await escrowA1.vest()
      })

      it('should get an accounts next vesting entry index', async () => {
        expect(await escrow.getNextVestingIndex(account1.address)).to.eq(1)
      })

      it('should get an accounts next vesting entry', async () => {
        expect((await escrow.getNextVestingEntry(account1.address))[1]).to.eq(expandTo18Decimals(2000))
      })

      it('should get an accounts next vesting time', async () => {
        const fiveDaysAhead = getYearFromNow() + DAY * 5
        expect(await escrow.getNextVestingTime(account1.address)).to.gte(fiveDaysAhead)
      })

      it('should get an accounts next vesting quantity', async () => {
        expect(await escrow.getNextVestingQuantity(account1.address)).to.eq(expandTo18Decimals(2000))
      })
    })

    describe('Vesting', async () => {
      beforeEach(async () => {
        await token.transfer(escrow.address, expandTo18Decimals(6000))
        await escrow.appendVestingEntry(account1.address, getYearFromNow(), expandTo18Decimals(1000))
        await escrow.appendVestingEntry(account1.address, getYearFromNow() + 1, expandTo18Decimals(2000))
        await escrow.appendVestingEntry(account1.address, getYearFromNow() + 2, expandTo18Decimals(3000))

        await mineBlock(provider, getYearFromNow() + WEEK * 3)
      })

      it('should vest and transfer token from contract to the user', async () => {
        const escrowA1 = escrow.connect(account1)
        await escrowA1.vest()

        expect(await token.balanceOf(account1.address)).to.eq(expandTo18Decimals(6000))
        expect(await token.balanceOf(escrow.address)).to.eq(0)
      })
    })
  })
})
