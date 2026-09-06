import { useEffect, useState } from "react";
import type { Signer } from "ethers";
import { formatEther } from "ethers";
import { getContract } from "../contracts/contract";
interface MarketplaceProps {
  signer: Signer | null;
  onPurchaseSuccess: () => void;
}

interface CardMetadata {
  name: string;
  description: string;
  image: string;
  attributes?: {
    trait_type: string;
    value: string | number;
  }[];
}

interface MarketplaceCard {
  tokenId: string;
  metadata: CardMetadata;
  seller: string;
  price: string;
  active: boolean;
}

function ipfsToGateway(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    return `https://gateway.pinata.cloud/ipfs/${uri.replace("ipfs://", "")}`;
  }

  return uri;
}

function Marketplace({
  signer,
  onPurchaseSuccess,
}: MarketplaceProps) {
  const [cards, setCards] = useState<MarketplaceCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [buyInProgress, setBuyInProgress] = useState<Record<string, boolean>>({});
  const [buyConfirmationPending, setBuyConfirmationPending] = useState<
  Record<string, boolean>
>({});

const handleBuyCard = async (
  tokenId: string,
  price: string
) => {
  if (!signer) {
    return;
  }

  if (buyInProgress[tokenId]) {
    return;
  }

  setBuyInProgress((prev) => ({
    ...prev,
    [tokenId]: true,
  }));

  let confirmationTimer: ReturnType<typeof setTimeout> | null =
    null;

  try {
    setError(null);

    setCardErrors((prev) => {
      const updated = { ...prev };
      delete updated[tokenId];
      return updated;
    });

    const contract = getContract(signer);

    confirmationTimer = setTimeout(() => {
      setBuyConfirmationPending((prev) => ({
        ...prev,
        [tokenId]: true,
      }));
    }, 5000);

    const transaction = await contract.buyCard(
      tokenId,
      {
        value: price,
      }
    );

    if (confirmationTimer) {
      clearTimeout(confirmationTimer);
      confirmationTimer = null;
    }

    setBuyConfirmationPending((prev) => ({
      ...prev,
      [tokenId]: false,
    }));

    await transaction.wait();

    console.log(
      "Card purchased successfully."
    );

    alert("Card purchased successfully!");

    setRefreshKey((prev) => prev + 1);
    onPurchaseSuccess();
  } catch (err: any) {
    console.error(
      "Failed to buy card:",
      err
    );

    if (confirmationTimer) {
      clearTimeout(confirmationTimer);
      confirmationTimer = null;
    }

    setBuyConfirmationPending((prev) => ({
      ...prev,
      [tokenId]: false,
    }));

    let message = "";

    if (
      err?.code === "INSUFFICIENT_FUNDS" ||
      err?.shortMessage
        ?.toLowerCase()
        .includes("insufficient funds")
    ) {
      message =
        "Insufficient Sepolia ETH. You need enough ETH to purchase this card and pay the gas fee.";
    } else if (
      err?.code === "ACTION_REJECTED"
    ) {
      message =
        "Transaction was rejected in MetaMask.";
    } else {
      message =
        "Failed to buy card. Please check your wallet and try again.";
    }

    setCardErrors((prev) => ({
      ...prev,
      [tokenId]: message,
    }));
  } finally {
    setBuyInProgress((prev) => ({
      ...prev,
      [tokenId]: false,
    }));

    setBuyConfirmationPending((prev) => ({
      ...prev,
      [tokenId]: false,
    }));
  }
};

  useEffect(() => {
    const loadCards = async () => {
      if (!signer) {
        setCards([]);
        return;
      }
      const address = await signer.getAddress();
      try {
        setLoading(true);
        setError(null);

        const contract = getContract(signer);

const provider = signer.provider;

if (!provider) {
  throw new Error("No provider available");
}

const deploymentBlock = 11612859;
const latestBlock = await provider.getBlockNumber();
const chunkSize = 9999;

let mintEvents: any[] = [];

for (
  let fromBlock = deploymentBlock;
  fromBlock <= latestBlock;
  fromBlock += chunkSize
) {
  const toBlock = Math.min(
    fromBlock + chunkSize - 1,
    latestBlock
  );

  const events = await contract.queryFilter(
    contract.filters.CardMinted(),
    fromBlock,
    toBlock
  );

  mintEvents.push(...events);
}

        console.log("Mint events found:", mintEvents.length);
        console.log("Mint events:", mintEvents);

        const loadedCards: MarketplaceCard[] = [];

        for (const event of mintEvents) {
          if (!("args" in event)) {
            continue;
          }

          const tokenId = event.args[0];

          const tokenURI = await contract.tokenURI(tokenId);
          // Ignore old/test NFTs with invalid or unavailable metadata
if (
  tokenId.toString() === "1" ||
  tokenId.toString() === "2" ||
  tokenId.toString() === "3"
) {
  continue;
}
const cid = tokenURI.replace("ipfs://", "");

try {
  const response = await fetch(
  `http://localhost:3001/api/metadata/${cid}`
);

  if (!response.ok) {
    console.warn(
      `Skipping token ${tokenId.toString()}: metadata unavailable`
    );
    continue;
  }

  const metadata: CardMetadata = await response.json();

  const listing = await contract.getListing(tokenId);

if (!listing[2]) {
  continue;
}

const owner = await contract.ownerOf(tokenId);

if (owner.toLowerCase() === address.toLowerCase()) {
  continue;
}

loadedCards.push({
  tokenId: tokenId.toString(),
  metadata,
  seller: listing[0],
  price: listing[1].toString(),
  active: listing[2],
});
} catch (metadataError) {
  console.warn(
    `Skipping token ${tokenId.toString()}: failed to load metadata`,
    metadataError
  );
}
        }

        setCards(loadedCards);
      } catch (err) {
        console.error("Failed to load marketplace:", err);
        setError("Failed to load marketplace cards.");
      } finally {
        setLoading(false);
      }
    };

    loadCards();
  }, [signer, refreshKey]);

  if (!signer) {
    return (
      <section className="mx-auto max-w-6xl px-8">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
          <h2 className="text-2xl font-bold">Marketplace</h2>
          <p className="mt-2 text-slate-400">
            Connect your MetaMask wallet to view the marketplace.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold">Marketplace</h2>
        <p className="mt-2 text-slate-400">
          Browse mythology-inspired digital cards.
        </p>
      </div>

      {loading && (
        <p className="text-center text-slate-400">
          Loading cards...
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-red-900/30 p-4 text-center text-red-300">
          {error}
        </p>
      )}

      {!loading && !error && cards.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
          <p className="text-slate-400">
            No cards have been listed yet.
          </p>
        </div>
      )}

      {!loading && cards.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.tokenId}
              className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900"
            >
              <img
  src={ipfsToGateway(card.metadata.image)}
  alt={card.metadata.name}
  className="aspect-[2/3] w-full object-contain bg-slate-950"
/>

              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-xl font-bold">
                    {card.metadata.name}
                  </h3>

                  <span className="rounded-full bg-purple-900/50 px-3 py-1 text-xs text-purple-300">
                    #{card.tokenId}
                  </span>
                </div>

                <p className="mt-3 text-sm text-slate-400">
                  {card.metadata.description}
                </p>

                {card.metadata.attributes &&
                  card.metadata.attributes.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {card.metadata.attributes.map((attribute) => (
                        <div
                          key={attribute.trait_type}
                          className="flex justify-between rounded-lg bg-slate-800 px-3 py-2 text-sm"
                        >
                          <span className="text-slate-400">
                            {attribute.trait_type}
                          </span>

                          <span className="font-semibold">
                            {attribute.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
<div className="mt-5 border-t border-slate-800 pt-4">
  <p className="text-sm text-slate-400">
    Listed for
  </p>

  <p className="mt-1 text-lg font-bold text-purple-400">
    {formatEther(card.price)} ETH
  </p>

  <button
  onClick={() => handleBuyCard(card.tokenId, card.price)}
  disabled={buyInProgress[card.tokenId]}
  className="mt-4 w-full rounded-lg bg-green-600 px-4 py-2 font-semibold hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
>
  {buyInProgress[card.tokenId]
    ? "Buying..."
    : "Buy Card"}
</button>
{buyConfirmationPending[card.tokenId] && (
  <p className="mt-3 text-sm text-yellow-400">
    MetaMask confirmation is still pending. Please confirm or reject the transaction in MetaMask.
  </p>
)}
  {cardErrors[card.tokenId] && (
    <p className="mt-3 text-sm text-red-400">
      {cardErrors[card.tokenId]}
    </p>
  )}
</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default Marketplace;