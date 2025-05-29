// scripts/TestUpload.ts
import { uploadRecord } from "./encrypt.ts"; 

const test = async () => {
  const testPatientAddress = "0xYourTestPatientAddressHere" as `0x${string}`;

  try {
    await uploadRecord(testPatientAddress);
    console.log("✅ Upload successful");
  } catch (error) {
    console.error("❌ Upload failed:", error);
  }
};

test();
