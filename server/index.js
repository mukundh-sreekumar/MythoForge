import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { PinataSDK } from "pinata";

dotenv.config();

const app = express();

app.use(cors());

const PORT = 3001;
const metadataCache = new Map();

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT,
});

app.get("/api/upload-url", async (req, res) => {
  try {
    if (!process.env.PINATA_JWT) {
      return res.status(500).json({
        error: "PINATA_JWT is not configured.",
      });
    }

    const type = req.query.type || "image";

    const url = await pinata.upload.public
      .createSignedURL({
        expires: 60,
        mimeTypes:
          type === "json"
            ? ["application/json"]
            : ["image/*"],
      });

    console.log(
      "Public Pinata signed URL created successfully."
    );

    res.json({ url });
  } catch (error) {
    console.error("Pinata signed URL error:", error);

    res.status(500).json({
      error: "Failed to create Pinata upload URL.",
    });
  }
});
app.get("/api/metadata/:cid", async (req, res) => {
  try {
    const { cid } = req.params;

    if (metadataCache.has(cid)) {
      console.log(`Serving cached metadata for ${cid}`);
      return res.json(metadataCache.get(cid));
    }

    if (!cid.startsWith("baf") && !cid.startsWith("Qm")) {
      return res.status(400).json({
        error: "Invalid IPFS CID.",
      });
    }

    const response = await fetch(
  `https://cyan-fancy-weasel-556.mypinata.cloud/ipfs/${cid}`
);

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Metadata could not be retrieved from IPFS.",
      });
    }

    const metadata = await response.json();

    metadataCache.set(cid, metadata);

    console.log(`Metadata cached for ${cid}`);

    res.json(metadata);
  } catch (error) {
    console.error("Metadata proxy error:", error);

    res.status(500).json({
      error: "Failed to retrieve metadata.",
    });
  }
});
app.listen(PORT, () => {
  console.log(
    `Pinata server running on http://localhost:${PORT}`
  );
});