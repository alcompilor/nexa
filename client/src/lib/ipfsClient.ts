/* eslint-disable @typescript-eslint/no-explicit-any */
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

const s3Client = new S3Client({
    endpoint: "https://s3.filebase.com",
    region: "us-east-1",
    credentials: {
        accessKeyId: import.meta.env.VITE_FILEBASE_KEY!,
        secretAccessKey: import.meta.env.VITE_FILEBASE_SECRET!,
    },
    forcePathStyle: true,
});

export async function ipfsStore(ciphertext: Uint8Array): Promise<string> {
    const fileKey = uuidv4();
    let extractedCid: string | undefined;

    const base64 = Buffer.from(ciphertext).toString("base64");
    const jsonBuffer = Buffer.from(JSON.stringify({ ciphertext: base64 }));

    const command = new PutObjectCommand({
        Bucket: import.meta.env.VITE_FILEBASE_BUCKET!,
        Key: fileKey,
        Body: jsonBuffer,
        ContentType: "application/json",
        ACL: "public-read",
    });

    command.middlewareStack.add(
        (next) => async (args) => {
            const response = await next(args);

            if (!(response.response as any).statusCode) return response;

            const cid = (response.response as any).headers["x-amz-meta-cid"];
            extractedCid = cid; // Capture in outer scope
            console.log("CID from middleware:", cid);

            return response;
        },
        {
            step: "build",
            name: "addCidToOutput",
        }
    );

    await s3Client.send(command);
    return extractedCid as string;
}

export async function ipfsRetrieve(cid: string): Promise<Uint8Array | null> {
    const url = `${import.meta.env.VITE_IPFS_ENDPOINT}/${cid}`;

    try {
        const response = await fetch(url);
        if (!response.ok)
            throw new Error(`HTTP error! Status: ${response.status}`);

        const { ciphertext } = await response.json();
        if (!ciphertext) return null;

        // Decode base64 to Uint8Array
        const buffer = Buffer.from(ciphertext, "base64");
        return new Uint8Array(buffer);
    } catch (error) {
        console.error("Failed to fetch from IPFS:", error);
        return null;
    }
}
