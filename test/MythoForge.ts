import { expect } from "chai";
import hre from "hardhat";

describe("MythoForge", function () {
  async function deployMythoForge() {
    const { ethers } = await hre.network.create();

    const [owner, buyer] = await ethers.getSigners();

    const MythoForge = await ethers.getContractFactory("MythoForge");
    const mythoForge = await MythoForge.deploy();

    return { mythoForge, owner, buyer, ethers };
  }

  describe("Minting", function () {
    it("should mint a card with a unique token ID", async function () {
      const { mythoForge, owner } = await deployMythoForge();

      await mythoForge.mintCard("ipfs://metadata1");

      expect(await mythoForge.ownerOf(1)).to.equal(owner.address);
      expect(await mythoForge.tokenURI(1)).to.equal("ipfs://metadata1");
    });

    it("should give different token IDs to different cards", async function () {
      const { mythoForge, owner } = await deployMythoForge();

      await mythoForge.mintCard("ipfs://metadata1");
      await mythoForge.mintCard("ipfs://metadata2");

      expect(await mythoForge.ownerOf(1)).to.equal(owner.address);
      expect(await mythoForge.ownerOf(2)).to.equal(owner.address);

      expect(await mythoForge.tokenURI(1)).to.equal("ipfs://metadata1");
      expect(await mythoForge.tokenURI(2)).to.equal("ipfs://metadata2");
    });
  });

  describe("Listing", function () {
    it("should allow an owner to list a card", async function () {
      const { mythoForge, owner, ethers } =
        await deployMythoForge();

      await mythoForge.mintCard("ipfs://metadata1");

      await mythoForge.setApprovalForAll(
  await mythoForge.getAddress(),
  true
);

      const price = ethers.parseEther("0.02");

      await mythoForge.listCard(1, price);

      const listing = await mythoForge.getListing(1);

      expect(listing.seller).to.equal(owner.address);
      expect(listing.price).to.equal(price);
      expect(listing.active).to.equal(true);
    });

    it("should reject listing without marketplace approval", async function () {
      const { mythoForge, ethers } =
        await deployMythoForge();

      await mythoForge.mintCard("ipfs://metadata1");

      const price = ethers.parseEther("0.02");

      await expect(
        mythoForge.listCard(1, price)
      ).to.be.revertedWith(
        "Marketplace not approved"
      );
    });
  });

  describe("Buying", function () {
    it("should transfer the card to the buyer", async function () {
      const { mythoForge, buyer, ethers } =
        await deployMythoForge();

      await mythoForge.mintCard("ipfs://metadata1");

      await mythoForge.setApprovalForAll(
  await mythoForge.getAddress(),
  true
);

      const price = ethers.parseEther("0.02");

      await mythoForge.listCard(1, price);

      await mythoForge
        .connect(buyer)
        .buyCard(1, { value: price });

      expect(
        await mythoForge.ownerOf(1)
      ).to.equal(buyer.address);
    });

    it("should deactivate the listing after purchase", async function () {
      const { mythoForge, buyer, ethers } =
        await deployMythoForge();

      await mythoForge.mintCard("ipfs://metadata1");

      await mythoForge.setApprovalForAll(
  await mythoForge.getAddress(),
  true
);

      const price = ethers.parseEther("0.02");

      await mythoForge.listCard(1, price);

      await mythoForge
        .connect(buyer)
        .buyCard(1, { value: price });

      const listing = await mythoForge.getListing(1);

      expect(listing.active).to.equal(false);
    });

    it("should reject an incorrect payment", async function () {
      const { mythoForge, buyer, ethers } =
        await deployMythoForge();

      await mythoForge.mintCard("ipfs://metadata1");

      await mythoForge.setApprovalForAll(
  await mythoForge.getAddress(),
  true
);

      const price = ethers.parseEther("0.02");
      const wrongPrice = ethers.parseEther("0.01");

      await mythoForge.listCard(1, price);

      await expect(
        mythoForge
          .connect(buyer)
          .buyCard(1, { value: wrongPrice })
      ).to.be.revertedWith(
        "Incorrect payment"
      );
    });
  });

  describe("Cancelling", function () {
    it("should allow the seller to cancel a listing", async function () {
      const { mythoForge, ethers } =
        await deployMythoForge();

      await mythoForge.mintCard("ipfs://metadata1");

      await mythoForge.setApprovalForAll(
  await mythoForge.getAddress(),
  true
);

      const price = ethers.parseEther("0.02");

      await mythoForge.listCard(1, price);

      await mythoForge.cancelListing(1);

      const listing = await mythoForge.getListing(1);

      expect(listing.active).to.equal(false);
      expect(listing.seller).to.equal(
        ethers.ZeroAddress
      );
    });
  });
});