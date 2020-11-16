import chai, { expect } from 'chai'
import { Contract, BigNumber } from 'ethers'
import { keccak256 } from '@ethersproject/keccak256'
import { defaultAbiCoder } from '@ethersproject/abi'
import { expandTo18Decimals, mineBlock, getCurrentTimestamp, getProxyInterface, getCreate2Address } from './shared/utilities'
import { solidity, MockProvider, createFixtureLoader } from 'ethereum-waffle'
import { AddressZero } from '@ethersproject/constants'
import { pack as solidityPack } from '@ethersproject/solidity'

import { configureRewards, configureEscrow, makeNotifyRewardAmounts, SCHCEDULE_ESCROW, COMMUNITY_AMOUNTS, COMMUNITY_TIMINGS } from '../scripts/deployBasic'
import { deployFixture, configurationDeployFixture } from './shared/fixtures'
import { WETH_ADDRESS, STAKING_PAIRS, ADVISER_ACCOUNT } from '../scripts/mainnetDeploy'

import WSProxyPair from '../build/WSProxyPair.json'

chai.use(solidity)

const overrides = {
  gasLimit: 9999999
}

describe('Deployment script', async () => {
  const provider = new MockProvider({
    ganacheOptions: {
      hardfork: 'istanbul',
      mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
      gasLimit: 9999999
    }
  })
  const [wallet, team, adviser] = provider.getWallets()
  const loadFixture = createFixtureLoader([wallet], provider)

  let factory: Contract
  let stakingFactory: Contract
  let govToken: Contract
  let timelock: Contract
  let escrow: Contract
  let controller: Contract
  let router: Contract
  let governor: Contract
  beforeEach(async () => {
    const fixture = await loadFixture(configurationDeployFixture)
    govToken = fixture.govToken
    governor = fixture.governor
    timelock = fixture.timelock
    escrow = fixture.escrow
    factory = fixture.pairFactory
    router = fixture.router
    controller = fixture.controller
    stakingFactory = fixture.stakingFactory
  })
  describe('Basic deploy', async () => {
    it('timelock has right admin', async () => {
      expect(await timelock.admin()).to.eq(governor.address)
    })

    it('governer has right timelock', async () => {
      expect(await governor.timelock()).to.eq(timelock.address)
    })

    it('governer has right gov token', async () => {
      expect(await governor.wse()).to.eq(govToken.address)
    })

    it('gov token has right minter', async () => {
      expect(await govToken.minter()).to.eq(timelock.address)
    })

    it('escrow use right token', async () => {
      expect(await escrow.token()).to.eq(govToken.address)
    })

    it('staking factory use right token', async () => {
      expect(await stakingFactory.rewardsToken()).to.eq(govToken.address)
    })
  })

  describe('Configuration', async () => {
    it('right token balances', async() => {
      expect(await govToken.balanceOf(wallet.address)).to.eq(expandTo18Decimals(40000000))
      expect(await govToken.balanceOf(stakingFactory.address)).to.eq(expandTo18Decimals(0))
      expect(await govToken.balanceOf(escrow.address)).to.eq(expandTo18Decimals(841500000))
      expect(await govToken.balanceOf(timelock.address)).to.eq(expandTo18Decimals(71000000))
      expect(await govToken.balanceOf(ADVISER_ACCOUNT)).to.eq(expandTo18Decimals(2500000))
    })

    it('right poll rewards', async() => {
      for(let i = 0; i < STAKING_PAIRS.length; i++) {
        const stakingToken = await stakingFactory.stakingTokens(i)
        const expectedTokenAddress = getCreate2Address(factory.address, [STAKING_PAIRS[i][0], STAKING_PAIRS[i][1]], `0x${WSProxyPair.evm.bytecode.object}`)
        expect(stakingToken).to.eq(expectedTokenAddress)

        const deployedRewardInfo = await stakingFactory.stakingRewardsInfoByStakingToken(stakingToken)
        expect(await govToken.balanceOf(deployedRewardInfo['stakingRewards'])).to.eq(STAKING_PAIRS[i][2])
      }
    })

    
    it('right vesting', async() => {
      let counters: {[id: string]: number} = {'':0}
      for( let key in SCHCEDULE_ESCROW){
        for(let i = 0; i < SCHCEDULE_ESCROW[key]['amounts'].length; i++) {
           const entry = await escrow.getVestingScheduleEntry(key, i)
          expect(entry[0]).to.eq(SCHCEDULE_ESCROW[key]['time'][i])
          expect(entry[1]).to.eq(SCHCEDULE_ESCROW[key]['amounts'][i])
        }
      }
      for(let i = 0; i < COMMUNITY_AMOUNTS.length; i++) {
           const entry = await escrow.getVestingScheduleEntry(timelock.address, i)
          expect(entry[0]).to.eq(COMMUNITY_TIMINGS[i])
          expect(entry[1]).to.eq(COMMUNITY_AMOUNTS[i])
        }
    })
  })
})