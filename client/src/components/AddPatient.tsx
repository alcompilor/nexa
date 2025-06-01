import { useState } from "react";
import { writeToContract } from "../lib/viemHelpers";
import { x25519 } from "@noble/curves/ed25519";
import { toHex } from "viem";
import { usePatientPrivKeyStore } from "../stores/usePatientPrivKeyStore";
import spinner from "../assets/spinner.svg";

export const AddPatient = () => {
    const [patientPubKey, setPatientPubKey] = useState<string>("");
    const [patientPrivKey, setPatientPrivKey] = useState<string>("");
    const [message, setMessage] = useState<string>("");
    const [showLoader, setShowLoader] = useState<boolean>(false);

    const { setPrivKey } = usePatientPrivKeyStore();

    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (name === "patientPubKey") setPatientPubKey(value);
        if (name === "patientPrivKey") setPatientPrivKey(value);
    };

    const handleButton = async () => {
        if (patientPubKey && patientPrivKey) {
            try {
                const privKeyHex = patientPrivKey.startsWith("0x")
                    ? patientPrivKey.slice(2)
                    : patientPrivKey;

                const pubKeyBytes = x25519.getPublicKey(privKeyHex);
                const validPubKey = toHex(pubKeyBytes);

                if (patientPubKey === validPubKey) {
                    setPrivKey(privKeyHex);
                    setShowLoader(true);
                    const txHash = await writeToContract({
                        functionName: "addPatient",
                        args: [patientPubKey],
                    });

                    setMessage(
                        `You Have Successfully Registered | Receipt: ${txHash}`
                    );
                } else {
                    setMessage(
                        "The keypair you provided appears to be invalid. Please check and try again."
                    );
                }
            } catch (error: unknown) {
                setMessage(`${error}`);
            }
        } else {
            setMessage(
                "Some inputs are invalid. Make sure all fields are filled out correctly."
            );
        }
        setShowLoader(false);
    };

    return (
        <div className="max-w-md mx-auto p-2 bg-white rounded-2xl mt-5">
            {showLoader && <img src={spinner} className="w-20" />}
            <p className="text-sm text-gray-600 mb-6 text-center break-words">
                {message}
            </p>
            <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                <input
                    type="text"
                    name="patientPubKey"
                    placeholder="Your ECDH X25519 public key (with 0x as prefix)"
                    value={patientPubKey}
                    onChange={handleInput}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                    type="text"
                    name="patientPrivKey"
                    placeholder="Your ECDH X25519 private key (with 0x as prefix)"
                    value={patientPrivKey}
                    onChange={handleInput}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                    type="button"
                    onClick={handleButton}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-200 hover:cursor-pointer"
                >
                    Register me as a Patient
                </button>
            </form>
        </div>
    );
};

export default AddPatient;
