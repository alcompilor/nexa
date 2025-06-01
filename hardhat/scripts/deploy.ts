import { ethers } from "hardhat";

async function main() {
    const NexaEHR = await ethers.getContractFactory("NexaEHR");

    // Example public keys (32-byte hex strings)
    const hospitalPublicKey = process.env.HOSPITAL_PUB_KEY || "";
    const oraclePublicKey1 = process.env.ORACLE1_PUB_KEY || "";
    const oraclePublicKey2 = process.env.ORACLE2_PUB_KEY || "";

    const contract = await NexaEHR.deploy(
        hospitalPublicKey,
        oraclePublicKey1,
        oraclePublicKey2
    );

    const tx = await contract.deploymentTransaction();
    const receipt = await tx.wait();

    console.log("✅ NexaEHR deployed to:", receipt?.contractAddress);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
