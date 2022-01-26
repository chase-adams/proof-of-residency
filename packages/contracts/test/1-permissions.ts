import { ethers } from 'hardhat';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { ProofOfResidency, FailingTreasuryTest, ReentrantTreasuryTest } from '../../web/types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { signCommitment, timeTravelToValid } from './util';
import { BigNumber } from 'ethers';

chai.use(chaiAsPromised);
const { expect } = chai;

const primaryLine = '370 WATER ST';
const secondaryLine = '';
const lastLine = 'SUMMERSIDE PE C1N 1C4';
const country = 'CA';
const mailingAddressId = BigNumber.from(
  '74931654352136841322477683321810728405693153704805913520852177993368555879610'
);

const baseUri = 'https://generator.proofofresidency.xyz/';

const secretCommitment = 'secret1';
const countryCommitment = 411;
const initialPrice = ethers.utils.parseEther('0.008');

describe('Proof of Residency: permissions', () => {
  let proofOfResidencyOwner: ProofOfResidency;
  let proofOfResidencyCommitter: ProofOfResidency;
  let proofOfResidencyTreasury: ProofOfResidency;
  let proofOfResidencyRequester1: ProofOfResidency;
  let proofOfResidencyRequester2: ProofOfResidency;
  let proofOfResidencyUnaffiliated: ProofOfResidency;

  let failingTreasuryContract: FailingTreasuryTest;
  let reentrantTreasuryContract: ReentrantTreasuryTest;

  let owner: SignerWithAddress;
  let committer: SignerWithAddress;
  let treasury: SignerWithAddress;
  let requester1: SignerWithAddress;
  let requester2: SignerWithAddress;
  let unaffiliated: SignerWithAddress;

  beforeEach(async () => {
    [owner, committer, treasury, requester1, requester2, unaffiliated] = await ethers.getSigners();

    const ProofOfResidency = await ethers.getContractFactory('ProofOfResidency');
    proofOfResidencyOwner = await ProofOfResidency.deploy(
      committer.address,
      treasury.address,
      baseUri,
      initialPrice
    );

    const FailingTreasuryTest = await ethers.getContractFactory('FailingTreasuryTest');
    failingTreasuryContract = await FailingTreasuryTest.deploy();

    const ReentrantTreasuryTest = await ethers.getContractFactory('ReentrantTreasuryTest');
    reentrantTreasuryContract = await ReentrantTreasuryTest.deploy(proofOfResidencyOwner.address);

    proofOfResidencyCommitter = proofOfResidencyOwner.connect(committer);
    proofOfResidencyTreasury = proofOfResidencyOwner.connect(treasury);

    proofOfResidencyRequester1 = proofOfResidencyOwner.connect(requester1);
    proofOfResidencyRequester2 = proofOfResidencyOwner.connect(requester2);

    proofOfResidencyUnaffiliated = proofOfResidencyOwner.connect(unaffiliated);
  });

  describe('PoR functions correctly (happy paths)', async () => {
    it('should succeed for assigning permissions to random person', async () => {
      await proofOfResidencyOwner.addCommitter(unaffiliated.address, unaffiliated.address);

      const { hash, hashedMailingAddress, v, r, s } = await signCommitment(
        requester1.address,
        countryCommitment,
        secretCommitment,

        primaryLine,
        secondaryLine,
        lastLine,
        country,

        proofOfResidencyOwner.address,
        unaffiliated
      );

      await proofOfResidencyRequester1.commitAddress(
        requester1.address,
        hash,
        hashedMailingAddress,
        v,
        r,
        s,
        {
          value: initialPrice
        }
      );

      await timeTravelToValid();

      await expect(proofOfResidencyRequester1.mint(countryCommitment, secretCommitment))
        .to.emit(proofOfResidencyRequester1, 'Transfer')
        .withArgs(
          ethers.constants.AddressZero,
          requester1.address,
          ethers.BigNumber.from('411000000000000001')
        );
    });

    it('should pause/unpause for owner', async () => {
      expect(await proofOfResidencyOwner.paused()).to.be.equal(false);

      await proofOfResidencyOwner.pause();
      expect(await proofOfResidencyOwner.paused()).to.be.equal(true);

      await proofOfResidencyOwner.unpause();
      expect(await proofOfResidencyOwner.paused()).to.be.equal(false);
    });

    it('should set price for owner', async () => {
      await proofOfResidencyOwner.setPrice(initialPrice.add(100));

      expect(await proofOfResidencyUnaffiliated.reservePrice()).to.equal(initialPrice.add(100));
    });

    it('should blacklist a mailing address ID for owner', async () => {
      await expect(proofOfResidencyOwner.blacklistMailingAddress(mailingAddressId)).to.emit(
        proofOfResidencyOwner,
        'MailingAddressBlacklisted'
      );

      const { hash, hashedMailingAddress, v, r, s } = await signCommitment(
        requester1.address,
        countryCommitment,
        secretCommitment,

        primaryLine,
        secondaryLine,
        lastLine,
        country,

        proofOfResidencyOwner.address,
        committer
      );

      await expect(
        proofOfResidencyRequester1.commitAddress(
          requester1.address,
          hash,
          hashedMailingAddress,
          v,
          r,
          s,
          {
            value: initialPrice
          }
        )
      ).to.be.revertedWith('Address blacklisted');
    });

    it('should remove committer for owner', async () => {
      await expect(proofOfResidencyOwner.removeCommitter(committer.address))
        .to.emit(proofOfResidencyOwner, 'CommitterRemoved')
        .withArgs(committer.address);
    });

    it('should be able to withdraw for committer', async () => {
      const { hash, hashedMailingAddress, v, r, s } = await signCommitment(
        requester1.address,
        countryCommitment,
        secretCommitment,

        primaryLine,
        secondaryLine,
        lastLine,
        country,

        proofOfResidencyOwner.address,
        committer
      );

      await proofOfResidencyRequester1.commitAddress(
        requester1.address,
        hash,
        hashedMailingAddress,
        v,
        r,
        s,
        {
          value: initialPrice
        }
      );

      await timeTravelToValid();

      await proofOfResidencyRequester1.mint(countryCommitment, secretCommitment);

      const originalTreasuryBalance = await treasury.getBalance();

      await proofOfResidencyCommitter.withdraw();

      expect((await treasury.getBalance()).sub(originalTreasuryBalance)).to.equal(initialPrice);
    });

    it('should be able to withdraw with a tax', async () => {
      await proofOfResidencyOwner.addCommitter(unaffiliated.address, requester2.address);

      const { hash, hashedMailingAddress, v, r, s } = await signCommitment(
        requester1.address,
        countryCommitment,
        secretCommitment,

        primaryLine,
        secondaryLine,
        lastLine,
        country,

        proofOfResidencyOwner.address,
        unaffiliated
      );

      await proofOfResidencyRequester1.commitAddress(
        requester1.address,
        hash,
        hashedMailingAddress,
        v,
        r,
        s,
        {
          value: initialPrice
        }
      );

      await timeTravelToValid();

      await proofOfResidencyRequester1.mint(countryCommitment, secretCommitment);

      const originalTreasuryBalance = await treasury.getBalance();
      const originalBalance = await requester2.getBalance();

      await proofOfResidencyUnaffiliated.withdraw();

      expect((await treasury.getBalance()).sub(originalTreasuryBalance)).to.equal(
        initialPrice.mul(20).div(100)
      );
      expect((await requester2.getBalance()).sub(originalBalance)).to.equal(
        initialPrice.mul(80).div(100)
      );
    });
  });

  describe('PoR functions correctly (sad paths)', async () => {
    it('should fail to withdraw when zero balance for committer', async () => {
      await expect(proofOfResidencyCommitter.withdraw()).to.be.revertedWith('Tax not over 0');
    });

    it('should fail to withdraw to the failing treasury contract', async () => {
      // USES FAILING TREASURY CONTRACT
      await proofOfResidencyOwner.addCommitter(
        unaffiliated.address,
        failingTreasuryContract.address
      );

      const { hash, hashedMailingAddress, v, r, s } = await signCommitment(
        requester1.address,
        countryCommitment,
        secretCommitment,

        primaryLine,
        secondaryLine,
        lastLine,
        country,

        proofOfResidencyOwner.address,
        unaffiliated
      );

      await proofOfResidencyRequester1.commitAddress(
        requester1.address,
        hash,
        hashedMailingAddress,
        v,
        r,
        s,
        {
          value: initialPrice
        }
      );

      await timeTravelToValid();

      await proofOfResidencyRequester1.mint(countryCommitment, secretCommitment);

      await expect(proofOfResidencyUnaffiliated.withdraw()).to.be.revertedWith(
        'Unable to withdraw'
      );

      // this is dumb but it's for code coverage :)
      await failingTreasuryContract.fallback();
    });

    it('should fail to withdraw to the reentrant treasury contract', async () => {
      // USES REENTRANT TREASURY CONTRACT
      await proofOfResidencyOwner.addCommitter(
        unaffiliated.address,
        reentrantTreasuryContract.address
      );

      const { hash, hashedMailingAddress, v, r, s } = await signCommitment(
        requester1.address,
        countryCommitment,
        secretCommitment,

        primaryLine,
        secondaryLine,
        lastLine,
        country,

        proofOfResidencyOwner.address,
        unaffiliated
      );

      await proofOfResidencyRequester1.commitAddress(
        requester1.address,
        hash,
        hashedMailingAddress,
        v,
        r,
        s,
        {
          value: initialPrice
        }
      );

      await timeTravelToValid();

      await proofOfResidencyRequester1.mint(countryCommitment, secretCommitment);

      await expect(proofOfResidencyUnaffiliated.withdraw()).to.be.revertedWith(
        'Unable to withdraw'
      );
    });

    it('should fail for public (no committing role)', async () => {
      const { hash, hashedMailingAddress, v, r, s } = await signCommitment(
        requester1.address,
        countryCommitment,
        secretCommitment,

        primaryLine,
        secondaryLine,
        lastLine,
        country,

        proofOfResidencyOwner.address,
        unaffiliated
      );

      await expect(
        proofOfResidencyRequester1.commitAddress(
          proofOfResidencyRequester1.address,
          hash,
          hashedMailingAddress,
          v,
          r,
          s,
          {
            value: initialPrice
          }
        )
      ).to.be.revertedWith('Signatory non-committer');
    });

    it('should fail for public (never committed)', async () => {
      await expect(
        proofOfResidencyRequester1.mint(countryCommitment, secretCommitment)
      ).to.be.revertedWith('Commitment incorrect');
    });

    it('should fail for public (never committed)', async () => {
      await expect(
        proofOfResidencyRequester1.mint(countryCommitment, secretCommitment)
      ).to.be.revertedWith('Commitment incorrect');
    });

    it('should fail to remove committer for public (no owner role)', async () => {
      await expect(
        proofOfResidencyRequester1.removeCommitter(committer.address)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    it('should fail to set price for public (no pausing role)', async () => {
      await expect(proofOfResidencyRequester1.setPrice(initialPrice.add(100))).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('should fail for public (no pausing role)', async () => {
      await expect(proofOfResidencyRequester1.pause()).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('should fail for public (no unpausing role)', async () => {
      await expect(proofOfResidencyRequester1.unpause()).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });

    it('should fail for public (no pausing role)', async () => {
      await expect(
        proofOfResidencyRequester1.addCommitter(requester1.address, requester1.address)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });
});
