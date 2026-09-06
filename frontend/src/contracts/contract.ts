import { ethers } from "ethers";
import { MythoForgeABI } from "./MythoForgeABI";

export const CONTRACT_ADDRESS = "0xaA7f0A43212De0AA9b3d499750e8861b320057b6";

export const getContract = (
  signerOrProvider: ethers.Signer | ethers.Provider
) => {
  return new ethers.Contract(
    CONTRACT_ADDRESS,
    MythoForgeABI,
    signerOrProvider
  );
};