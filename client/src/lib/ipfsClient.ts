import { create } from "ipfs-http-client";

// Replace with Infura credentials (create a free Infura IPFS project if needed)
const projectId = "YOUR_INFURA_PROJECT_ID";
const projectSecret = "YOUR_INFURA_PROJECT_SECRET";
const auth =
  "Basic " + Buffer.from(`${projectId}:${projectSecret}`).toString("base64");

export const ipfs = create({
  host: "ipfs.infura.io",
  port: 5001,
  protocol: "https",
  headers: {
    authorization: auth,
  },
});
