import { useEffect, useState } from "react";
import type { Signer } from "ethers";
import { getContract } from "../contracts/contract";
import { parseEther, formatEther } from "ethers";

interface MyCollectionProps {
  signer: Signer | null;
  refreshTrigger: number;
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

interface CollectionCard {
  tokenId: string;
  metadata: CardMetadata;
  price: string;
  active: boolean;
}

function ipfsToGateway(uri: string): string {
  if (uri.startsWith("ipfs://")) {
    return `https://gateway.pinata.cloud/ipfs/${uri.replace(
      "ipfs://",
      ""
    )}`;
  }

  return uri;
}

function MyCollection({
  signer,
  refreshTrigger,
}: MyCollectionProps) {
    const [cards, setCards] = useState<CollectionCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [listingInProgress, setListingInProgress] =
  useState<Record<string, boolean>>({});

const [cancelInProgress, setCancelInProgress] =
  useState<Record<string, boolean>>({});

const [listingConfirmationPending, setListingConfirmationPending] =
  useState<Record<string, boolean>>({});

const [cancelConfirmationPending, setCancelConfirmationPending] =
  useState<Record<string, boolean>>({});

const [showListingNotice, setShowListingNotice] = useState(false);
const [listingCardPending, setListingCardPending] = useState<{
  tokenId: string;
  price: string;
} | null>(null);
    const handleListCard = async (
  tokenId: string,
  price: string
) => {
  if (!signer) {
    return;
  }

  if (listingInProgress[tokenId]) {
    return;
  }

  setListingInProgress((prev) => ({
    ...prev,
    [tokenId]: true,
  }));

  let confirmationTimer: ReturnType<typeof setTimeout> | null =
    null;
  let listingConfirmationTimer: ReturnType<typeof setTimeout> | null =
    null;

  try {
    const priceInWei = parseEther(price);

    const contract = getContract(signer);

    // -------------------------
    // FIRST CONFIRMATION
    // -------------------------

    confirmationTimer = setTimeout(() => {
      setListingConfirmationPending((prev) => ({
        ...prev,
        [tokenId]: true,
      }));
    }, 5000);

    const approvalTx =
      await contract.setApprovalForAll(
        await contract.getAddress(),
        true
      );

    // MetaMask has accepted/submitted the transaction.
    // Stop showing the "confirmation pending" warning.
    if (confirmationTimer) {
      clearTimeout(confirmationTimer);
      confirmationTimer = null;
    }

    setListingConfirmationPending((prev) => ({
      ...prev,
      [tokenId]: false,
    }));

    // Wait for blockchain confirmation
    await approvalTx.wait();

    // -------------------------
    // SECOND CONFIRMATION
    // -------------------------

    listingConfirmationTimer = setTimeout(() => {
      setListingConfirmationPending((prev) => ({
        ...prev,
        [tokenId]: true,
      }));
    }, 5000);

    const listingTx =
      await contract.listCard(
        tokenId,
        priceInWei
      );

    // MetaMask has accepted/submitted the transaction.
    // Stop showing the "confirmation pending" warning.
    if (listingConfirmationTimer) {
      clearTimeout(listingConfirmationTimer);
      listingConfirmationTimer = null;
    }

    setListingConfirmationPending((prev) => ({
      ...prev,
      [tokenId]: false,
    }));

    // Wait for blockchain confirmation
    await listingTx.wait();

    alert(
      `Card #${tokenId} listed successfully!`
    );

    window.location.reload();
  } catch (err: any) {
    console.error(
      "Listing failed:",
      err
    );

    if (confirmationTimer) {
      clearTimeout(confirmationTimer);
    }

    if (listingConfirmationTimer) {
      clearTimeout(listingConfirmationTimer);
    }

    setListingConfirmationPending((prev) => ({
      ...prev,
      [tokenId]: false,
    }));

    if (err?.code === "ACTION_REJECTED") {
      alert(
        "Transaction rejected in MetaMask."
      );
    } else {
      alert("Failed to list this card.");
    }
  } finally {
    setListingInProgress((prev) => ({
      ...prev,
      [tokenId]: false,
    }));

    setListingConfirmationPending((prev) => ({
      ...prev,
      [tokenId]: false,
    }));
  }
};
  const handleCancelListing = async (tokenId: string) => {
    if (!signer) {
      return;
    }

    if (cancelInProgress[tokenId]) {
      return;
    }

    setCancelInProgress((prev) => ({
      ...prev,
      [tokenId]: true,
    }));

    let confirmationTimer: ReturnType<typeof setTimeout> | null =
      null;

    try {
      const contract = getContract(signer);

      confirmationTimer = setTimeout(() => {
        setCancelConfirmationPending((prev) => ({
          ...prev,
          [tokenId]: true,
        }));
      }, 5000);

      const tx = await contract.cancelListing(tokenId);

      if (confirmationTimer) {
        clearTimeout(confirmationTimer);
        confirmationTimer = null;
      }

      setCancelConfirmationPending((prev) => ({
        ...prev,
        [tokenId]: false,
      }));

      await tx.wait();

      alert(
        `Listing for card #${tokenId} cancelled successfully!`
      );

      window.location.reload();
    } catch (err: any) {
      console.error(
        "Cancel listing failed:",
        err
      );

      if (confirmationTimer) {
        clearTimeout(confirmationTimer);
      }

      setCancelConfirmationPending((prev) => ({
        ...prev,
        [tokenId]: false,
      }));

      if (err?.code === "ACTION_REJECTED") {
        alert(
          "Transaction rejected in MetaMask."
        );
      } else {
        alert(
          "Failed to cancel this listing."
        );
      }
    } finally {
      setCancelInProgress((prev) => ({
        ...prev,
        [tokenId]: false,
      }));

      setCancelConfirmationPending((prev) => ({
        ...prev,
        [tokenId]: false,
      }));
    }
  };
  useEffect(() => {
    const loadCollection = async () => {
      if (!signer) {
        setCards([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const contract = getContract(signer);
        const provider = signer.provider;

        if (!provider) {
          throw new Error("No provider available");
        }

        const walletAddress = (
          await signer.getAddress()
        ).toLowerCase();

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

        const loadedCards: CollectionCard[] = [];

        for (const event of mintEvents) {
          if (!("args" in event)) {
            continue;
          }

          const tokenId = event.args[0];

          // Ignore old/test NFTs
          if (
            tokenId.toString() === "1" ||
            tokenId.toString() === "2" ||
            tokenId.toString() === "3"
          ) {
            continue;
          }

          try {
            // Check current owner
            const owner = await contract.ownerOf(tokenId);

            if (owner.toLowerCase() !== walletAddress) {
              continue;
            }

            // Get metadata URI
            const tokenURI = await contract.tokenURI(tokenId);
            const cid = tokenURI.replace("ipfs://", "");

            // Load metadata through our backend proxy
            const response = await fetch(
              `http://localhost:3001/api/metadata/${cid}`
            );

            if (!response.ok) {
              console.warn(
                `Skipping token ${tokenId.toString()}: metadata unavailable`
              );
              continue;
            }

            const metadata: CardMetadata =
              await response.json();
            const listing = await contract.getListing(tokenId);
            loadedCards.push({
              tokenId: tokenId.toString(),
              metadata,
              price: formatEther(listing[1]),
              active: listing[2],
            });
          } catch (cardError) {
            console.warn(
              `Skipping token ${tokenId.toString()}: failed to load card`,
              cardError
            );
          }
        }

        setCards(loadedCards);
      } catch (err) {
        console.error(
          "Failed to load collection:",
          err
        );

        setError(
          "Failed to load your collection."
        );
      } finally {
        setLoading(false);
      }
    };

    loadCollection();
  }, [signer, refreshTrigger]);

  if (!signer) {
    return null;
  }

  return (
    <section className="mx-auto mt-16 max-w-6xl px-8">
      <div className="mb-8">
        <h2 className="text-3xl font-bold">
          My Collection
        </h2>

        <p className="mt-2 text-slate-400">
          Cards currently owned by your wallet.
        </p>
      </div>

      {loading && (
        <p className="text-center text-slate-400">
          Loading your collection...
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
            You don't own any MythoForge cards yet.
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
                      {card.metadata.attributes.map(
                        (attribute) => (
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
                        )
                      )}
                    </div>
                  )}

                <div className="mt-5 border-t border-slate-800 pt-4">
  {card.active ? (
    <>
      <p className="text-sm text-yellow-400">
        Listed for {card.price} ETH
      </p>

<button
  onClick={() =>
    handleCancelListing(card.tokenId)
  }
  disabled={cancelInProgress[card.tokenId]}
  className="mt-3 w-full rounded-lg bg-red-600 px-4 py-2 font-semibold hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
>
  {cancelInProgress[card.tokenId]
    ? "Cancelling..."
    : "Cancel Listing"}
</button>
{cancelConfirmationPending[card.tokenId] && (
  <p className="mt-3 text-sm text-yellow-400">
    MetaMask confirmation is still pending. Please confirm or reject the transaction in MetaMask.
  </p>
)}
    </>
    ) : (
    <>
      <p className="text-sm text-green-400">
        Owned by you
      </p>

      <div className="mt-3 flex flex-col gap-3">
        <input
          type="number"
          step="0.001"
          min="0"
          placeholder="Price in ETH"
          value={prices[card.tokenId] || ""}
          onChange={(e) =>
            setPrices((prev) => ({
              ...prev,
              [card.tokenId]: e.target.value,
            }))
          }
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white outline-none"
        />

        <button
          onClick={() => {
  setListingCardPending({
    tokenId: card.tokenId,
    price: prices[card.tokenId] || "",
  });
  setShowListingNotice(true);
}}
          disabled={
            !prices[card.tokenId] ||
            listingInProgress[card.tokenId]
          }
          className="rounded-lg bg-purple-600 px-4 py-2 font-semibold hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {listingInProgress[card.tokenId]
            ? "Listing..."
            : "List for Sale"}
        </button>

        {listingConfirmationPending[card.tokenId] && (
          <p className="text-sm text-yellow-400">
            MetaMask confirmation is still pending. Please confirm or reject the transaction in MetaMask.
          </p>
        )}
      </div>
    </>
  )}
</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {showListingNotice && listingCardPending && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
    <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
      <h3 className="text-xl font-bold">
        Listing Requires 2 Confirmations
      </h3>

      <p className="mt-3 text-sm text-slate-300">
        Listing a card requires two confirmations in MetaMask.
        You will first approve the marketplace, then confirm
        the listing transaction.
      </p>

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => {
            setShowListingNotice(false);
            setListingCardPending(null);
          }}
          className="flex-1 rounded-lg bg-slate-700 px-4 py-2 font-semibold hover:bg-slate-600"
        >
          Cancel
        </button>

        <button
          onClick={() => {
            const { tokenId, price } = listingCardPending;

            setShowListingNotice(false);
            setListingCardPending(null);

            handleListCard(tokenId, price);
          }}
          className="flex-1 rounded-lg bg-purple-600 px-4 py-2 font-semibold hover:bg-purple-700"
        >
          Continue
        </button>
      </div>
    </div>
  </div>
)}
    </section>
  );
}

export default MyCollection;