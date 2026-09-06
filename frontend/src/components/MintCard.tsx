import { useState } from "react";
import { ethers } from "ethers";
import { getContract } from "../contracts/contract";

interface MintCardProps {
  signer: ethers.Signer | null;
  onMintSuccess: () => void;
}

export default function MintCard({
  signer,
  onMintSuccess,
}: MintCardProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rarity, setRarity] = useState("Common");
  const [attack, setAttack] = useState("");
  const [defense, setDefense] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [tokenId, setTokenId] = useState<string | null>(null);

  const [mintInProgress, setMintInProgress] =
    useState(false);

  const [mintConfirmationPending, setMintConfirmationPending] =
    useState(false);

  // --------------------------------------------------
  // Handle image selection
  // --------------------------------------------------
  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0] || null;

    setImage(file);
    setStatus("");
  };

  // --------------------------------------------------
  // Upload image to Pinata
  // --------------------------------------------------
  const uploadImage = async (): Promise<string | null> => {
    if (!image) {
      setStatus("Please select a card image.");
      return null;
    }

    try {
      setStatus("Getting Pinata upload URL...");

      const urlResponse = await fetch(
        "http://localhost:3001/api/upload-url?type=image"
      );

      if (!urlResponse.ok) {
        throw new Error(
          "Failed to get Pinata upload URL."
        );
      }

      const { url } = await urlResponse.json();

      setStatus("Uploading image to IPFS...");

      const formData = new FormData();
      formData.append("file", image);

      const uploadResponse = await fetch(url, {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();

        console.error(
          "Pinata image upload status:",
          uploadResponse.status
        );

        console.error(
          "Pinata image upload error:",
          errorText.slice(0, 500)
        );

        throw new Error(
          "Image upload to Pinata failed."
        );
      }

      const uploadData = await uploadResponse.json();

      console.log(
        "Pinata image upload response:",
        uploadData
      );

      const cid = uploadData.data?.cid;

      if (!cid) {
        throw new Error(
          "Pinata did not return an image CID."
        );
      }

      console.log("Image IPFS CID:", cid);
      console.log(
        "Image URI:",
        `ipfs://${cid}`
      );

      return cid;
    } catch (error) {
      console.error(
        "Image upload failed:",
        error
      );

      setStatus(
        "Image upload failed. Check the browser console."
      );

      return null;
    }
  };

  // --------------------------------------------------
  // Upload metadata JSON to Pinata
  // --------------------------------------------------
  const uploadMetadata = async (
    imageCid: string
  ): Promise<string | null> => {
    try {
      setStatus("Creating card metadata...");

      const metadata = {
        name: name.trim(),
        description: description.trim(),
        image: `ipfs://${imageCid}`,
        attributes: [
          {
            trait_type: "Rarity",
            value: rarity,
          },
          {
            trait_type: "Attack",
            value: Number(attack),
          },
          {
            trait_type: "Defense",
            value: Number(defense),
          },
        ],
      };

      console.log("Metadata:", metadata);

      setStatus(
        "Getting Pinata metadata upload URL..."
      );

      const urlResponse = await fetch(
        "http://localhost:3001/api/upload-url?type=json"
      );

      if (!urlResponse.ok) {
        throw new Error(
          "Failed to get Pinata metadata upload URL."
        );
      }

      const { url } = await urlResponse.json();

      setStatus("Uploading metadata to IPFS...");

      const metadataBlob = new Blob(
        [JSON.stringify(metadata)],
        {
          type: "application/json",
        }
      );

      const formData = new FormData();

      formData.append(
        "file",
        metadataBlob,
        "metadata.json"
      );

      const uploadResponse = await fetch(url, {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();

        console.error(
          "Pinata metadata upload status:",
          uploadResponse.status
        );

        console.error(
          "Pinata metadata upload error:",
          errorText.slice(0, 500)
        );

        throw new Error(
          "Metadata upload to Pinata failed."
        );
      }

      const uploadData = await uploadResponse.json();

      console.log(
        "Pinata metadata upload response:",
        uploadData
      );

      const metadataCid =
        uploadData.data?.cid;

      if (!metadataCid) {
        throw new Error(
          "Pinata did not return a metadata CID."
        );
      }

      console.log(
        "Metadata IPFS CID:",
        metadataCid
      );

      console.log(
        "Metadata URI:",
        `ipfs://${metadataCid}`
      );

      return metadataCid;
    } catch (error) {
      console.error(
        "Metadata upload failed:",
        error
      );

      setStatus(
        "Metadata upload failed. Check the browser console."
      );

      return null;
    }
  };

  // --------------------------------------------------
  // Mint NFT
  // --------------------------------------------------
  const handleMint = async () => {
    if (!signer) {
      setStatus(
        "Please connect MetaMask first."
      );
      return;
    }

    if (mintInProgress) {
      return;
    }

    if (!name.trim()) {
      setStatus("Please enter a card name.");
      return;
    }

    if (!description.trim()) {
      setStatus(
        "Please enter a card description."
      );
      return;
    }

    if (!image) {
      setStatus(
        "Please select a card image."
      );
      return;
    }

    if (!attack || !defense) {
      setStatus(
        "Please enter attack and defense values."
      );
      return;
    }

    setMintInProgress(true);
    setMintConfirmationPending(false);

    try {
      setTokenId(null);

      // 1. Upload image
      const imageCid = await uploadImage();

      if (!imageCid) {
        return;
      }

      // 2. Upload metadata
      const metadataCid =
        await uploadMetadata(imageCid);

      if (!metadataCid) {
        return;
      }

      const metadataURI =
        `ipfs://${metadataCid}`;

      console.log(
        "Final metadata URI:",
        metadataURI
      );

      // 3. Connect to MythoForge contract
      setStatus(
        "Preparing NFT mint transaction..."
      );

      const contract = getContract(signer);

      // 4. Mint NFT
      const confirmationTimer =
        setTimeout(() => {
          setMintConfirmationPending(true);
        }, 5000);

      const tx = await contract.mintCard(
        metadataURI
      );

      clearTimeout(confirmationTimer);
      setMintConfirmationPending(false);

      console.log(
        "Mint transaction:",
        tx.hash
      );

      setStatus(
        "Waiting for blockchain confirmation..."
      );

      // 5. Wait for blockchain confirmation
      const receipt = await tx.wait();

      console.log(
        "Mint transaction receipt:",
        receipt
      );

      // 6. Find CardMinted event
      const event = receipt.logs
        .map(
          (
            log: ethers.Log | ethers.EventLog
          ) => {
            try {
              return contract.interface.parseLog({
                topics: log.topics,
                data: log.data,
              });
            } catch {
              return null;
            }
          }
        )
        .find(
          (
            parsed: ethers.LogDescription | null
          ) => parsed?.name === "CardMinted"
        );

      if (event) {
        const mintedTokenId =
          event.args[0].toString();

        setTokenId(mintedTokenId);

        setStatus(
          "Card minted successfully!"
        );

        console.log(
          "Minted Token ID:",
          mintedTokenId
        );

        // Refresh My Collection
        onMintSuccess();
      } else {
        setStatus(
          "NFT minted, but token ID could not be found."
        );
      }
    } catch (error) {
      console.error(
        "Minting failed:",
        error
      );

      setStatus(
        "Minting failed. Check MetaMask and the browser console."
      );
    } finally {
      setMintInProgress(false);
      setMintConfirmationPending(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 shadow-xl">
      <h2 className="mb-6 text-3xl font-bold text-slate-900">
        Mint a Mythology Card
      </h2>

      {/* Card Name */}
      <div className="mb-5">
        <label className="mb-2 block font-semibold text-slate-700">
          Card Name
        </label>

        <input
          type="text"
          placeholder="e.g. Athena"
          value={name}
          onChange={(e) =>
            setName(e.target.value)
          }
          className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 placeholder-slate-400 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
        />
      </div>

      {/* Description */}
      <div className="mb-5">
        <label className="mb-2 block font-semibold text-slate-700">
          Description
        </label>

        <textarea
          placeholder="Describe your mythology-inspired card..."
          value={description}
          onChange={(e) =>
            setDescription(e.target.value)
          }
          rows={4}
          className="w-full resize-none rounded-lg border border-slate-300 bg-white p-3 text-slate-900 placeholder-slate-400 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
        />
      </div>

      {/* Image */}
<div className="mb-5">
  <label className="mb-2 block font-semibold text-slate-700">
    Card Image
  </label>

  <input
    id="card-image-upload"
    type="file"
    accept="image/*"
    onChange={handleFileChange}
    className="hidden"
  />

  <button
    type="button"
    disabled={!!image}
    onClick={() =>
      document
        .getElementById("card-image-upload")
        ?.click()
    }
    className="rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
  >
    Choose File
  </button>

  {image && (
    <div className="mt-3 flex items-center gap-3">
      <p className="text-sm text-slate-500">
        Selected: {image.name}
      </p>

      <button
        type="button"
        onClick={() => {
          setImage(null);

          const fileInput =
            document.getElementById(
              "card-image-upload"
            ) as HTMLInputElement | null;

          if (fileInput) {
            fileInput.value = "";
          }
        }}
        className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
      >
        Remove
      </button>
    </div>
  )}
</div>

      {/* Rarity */}
      <div className="mb-5">
        <label className="mb-2 block font-semibold text-slate-700">
          Rarity
        </label>

        <select
          value={rarity}
          onChange={(e) =>
            setRarity(e.target.value)
          }
          className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
        >
          <option value="Common">
            Common
          </option>
          <option value="Uncommon">
            Uncommon
          </option>
          <option value="Rare">
            Rare
          </option>
          <option value="Epic">
            Epic
          </option>
          <option value="Legendary">
            Legendary
          </option>
        </select>
      </div>

      {/* Attributes */}
      <div className="mb-6">
        <label className="mb-2 block font-semibold text-slate-700">
          Card Attributes
        </label>

        <div className="grid grid-cols-2 gap-4">
          {/* Attack */}
          <div>
            <label className="mb-1 block text-sm text-slate-500">
              Attack
            </label>

            <input
              type="number"
              min="0"
              placeholder="e.g. 80"
              value={attack}
              onChange={(e) =>
                setAttack(e.target.value)
              }
              className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 placeholder-slate-400 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
            />
          </div>

          {/* Defense */}
          <div>
            <label className="mb-1 block text-sm text-slate-500">
              Defense
            </label>

            <input
              type="number"
              min="0"
              placeholder="e.g. 70"
              value={defense}
              onChange={(e) =>
                setDefense(e.target.value)
              }
              className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 placeholder-slate-400 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
            />
          </div>
        </div>
      </div>

      {/* Mint Button */}
      <button
        onClick={handleMint}
        disabled={!signer || mintInProgress}
        className="w-full rounded-lg bg-purple-600 py-3 font-semibold text-white transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {mintInProgress
          ? "Minting..."
          : signer
          ? "Mint Card"
          : "Connect Wallet First"}
      </button>

      {/* MetaMask Confirmation Pending */}
      {mintConfirmationPending && (
        <p className="mt-3 text-center text-sm text-yellow-600">
          MetaMask confirmation is still pending.
          Please confirm or reject the transaction
          in MetaMask.
        </p>
      )}

      {/* Status */}
      {status && (
        <p className="mt-5 text-center text-sm text-slate-700">
          {status}
        </p>
      )}

      {/* Token ID */}
      {tokenId && (
        <p className="mt-2 text-center font-semibold text-purple-700">
          Token ID: {tokenId}
        </p>
      )}
    </div>
  );
}