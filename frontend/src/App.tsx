import { useEffect, useState } from "react";
import { BrowserProvider } from "ethers";
import type { Signer } from "ethers";
import MintCard from "./components/MintCard";
import Marketplace from "./components/Marketplace";
import MyCollection from "./components/MyCollection";

interface EthereumProvider {
  request: (args: {
    method: string;
    params?: unknown[];
  }) => Promise<unknown>;

  on: (
    event: string,
    handler: (...args: any[]) => void
  ) => void;

  removeListener: (
    event: string,
    handler: (...args: any[]) => void
  ) => void;
}

function App() {
  const [account, setAccount] = useState<string | null>(null);
  const [signer, setSigner] = useState<Signer | null>(null);
  const [collectionRefresh, setCollectionRefresh] = useState(0);

  const refreshCollection = () => {
  setCollectionRefresh((value) => value + 1);
};

  const connectWallet = async () => {
  if (!window.ethereum) {
    alert("Please install MetaMask.");
    return;
  }

  try {
    await window.ethereum.request({
      method: "wallet_requestPermissions",
      params: [
        {
          eth_accounts: {},
        },
      ],
    });

    const provider = new BrowserProvider(
      window.ethereum as unknown as EthereumProvider
    );

    const accounts = await provider.send("eth_accounts", []);

    if (accounts.length === 0) {
      return;
    }

    const network = await provider.getNetwork();

    if (network.chainId !== 11155111n) {
      alert("Please switch MetaMask to Ethereum Sepolia.");
      return;
    }

    const walletSigner = await provider.getSigner(accounts[0]);
    localStorage.removeItem("mythoforge_disconnected");
    setAccount(accounts[0]);
    setSigner(walletSigner);
  } catch (error: any) {
    console.error("Wallet connection failed:", error);

    if (error?.code === 4001) {
      alert("Wallet connection was cancelled in MetaMask.");
    } else if (
      error?.message?.includes("already pending")
    ) {
      alert(
        "A MetaMask request is already open. Please complete or reject it before trying again."
      );
    } else {
      alert("Failed to connect wallet.");
    }
  }
};

  const disconnectWallet = async () => {
  if (!window.ethereum) {
    return;
  }

  try {
    await window.ethereum.request({
      method: "wallet_revokePermissions",
      params: [
        {
          eth_accounts: {},
        },
      ],
    });

    localStorage.setItem("mythoforge_disconnected", "true");

    setAccount(null);
    setSigner(null);
  } catch (error: any) {
    console.error("Failed to disconnect wallet:", error);

    if (error?.code === 4001) {
      alert("Disconnect request was cancelled in MetaMask.");
    } else {
      alert("Failed to disconnect wallet.");
    }
  }
};

useEffect(() => {
  const restoreWalletConnection = async () => {
    if (!window.ethereum) {
      return;
    }
    if (localStorage.getItem("mythoforge_disconnected") === "true") {
  return;
}
    try {
      const provider = new BrowserProvider(
  window.ethereum as unknown as EthereumProvider
);

      const accounts = await provider.send("eth_accounts", []);

      if (accounts.length === 0) {
        return;
      }

      const network = await provider.getNetwork();

      if (network.chainId !== 11155111n) {
        return;
      }

      const walletSigner = await provider.getSigner(accounts[0]);
      localStorage.removeItem("mythoforge_disconnected");

      setAccount(accounts[0]);
      setSigner(walletSigner);
    } catch (error) {
      console.error("Failed to restore wallet connection:", error);
    }
  };

  const handleAccountsChanged = async (accounts: string[]) => {
    if (accounts.length === 0) {
      setAccount(null);
      setSigner(null);
      return;
    }

    try {
      const provider = new BrowserProvider(
  window.ethereum as unknown as EthereumProvider
);

      const walletSigner = await provider.getSigner(accounts[0]);

      setAccount(accounts[0]);
      setSigner(walletSigner);
    } catch (error) {
      console.error("Failed to switch wallet:", error);
    }
  };

  restoreWalletConnection();

  (window.ethereum as unknown as EthereumProvider)?.on(
  "accountsChanged",
  handleAccountsChanged
);

  return () => {
    (window.ethereum as unknown as EthereumProvider)?.removeListener(
  "accountsChanged",
  handleAccountsChanged
);
  };
}, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="flex items-center justify-between px-8 py-5 border-b border-slate-800">
        <h1 className="text-2xl font-bold">MythoForge</h1>

        {account ? (
  <div className="flex items-center gap-3">
    <div className="rounded-lg bg-slate-800 px-4 py-2 text-sm">
      {account.slice(0, 6)}...{account.slice(-4)}
    </div>

    <button
      onClick={disconnectWallet}
      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-700"
    >
      Disconnect
    </button>
  </div>
) : (
  <button
    onClick={connectWallet}
    className="rounded-lg bg-purple-600 px-5 py-2 font-semibold hover:bg-purple-700"
  >
    Connect Wallet
  </button>
)}
      </header>

      <main className="py-12">
        <div className="text-center mb-12">
          <h2 className="text-5xl font-bold">
            Forge Your Myth
          </h2>

          <p className="mt-4 text-lg text-slate-400">
            Mint, collect, and trade mythology-inspired digital cards.
          </p>
        </div>

        <MintCard
  signer={signer}
  onMintSuccess={refreshCollection}
/>

<div className="mt-16">
  <Marketplace
  signer={signer}
  onPurchaseSuccess={refreshCollection}
/>
</div>
<div className="mt-16">
  <MyCollection
  signer={signer}
  refreshTrigger={collectionRefresh}
/>
</div>
      </main>
    </div>
  );
}

export default App;