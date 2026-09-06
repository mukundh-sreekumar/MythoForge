import { network } from "hardhat";

const { ethers } = await network.create();

console.log("Deploying MythoForge...");

const mythoForge = await ethers.deployContract("MythoForge");

await mythoForge.waitForDeployment();

const address = await mythoForge.getAddress();

console.log("MythoForge deployed successfully!");
console.log("Contract address:", address);