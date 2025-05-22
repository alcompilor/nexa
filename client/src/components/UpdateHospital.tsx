import { useState } from "react";
import { writeToContract } from "../lib/viemHelpers";
import spinner from "../assets/spinner.svg";

export const UpdateHospital = () => {
    const [hospitalAddress, setHospitalAddress] = useState<string>("");
    const [hospitalPubKey, setHospitalPubKey] = useState<string>("");
    const [message, setMessage] = useState<string>("");
    const [showLoader, setShowLoader] = useState<boolean>(false);

    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (name === "hospitalAddress") setHospitalAddress(value);
        else if (name === "hospitalPubKey") setHospitalPubKey(value);
    };

    const handleButton = async () => {
        if (hospitalAddress && hospitalPubKey) {
            try {
                setShowLoader(true);
                const txHash = await writeToContract({
                    functionName: "updateHospital",
                    args: [hospitalAddress, hospitalPubKey],
                });
                setMessage(
                    `Hospital Successfully Updated | Receipt: ${txHash}`
                );
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
            <div
                className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6"
                role="alert"
            >
                <strong className="font-bold">⚠️ Danger!</strong>
                <span className="block mt-1">
                    Updating the hospital information will{" "}
                    <strong>permanently renounce ownership</strong> to the new
                    hospital details on the smart contract. This action is
                    irreversible.
                </span>
            </div>
            <p className="text-sm text-gray-600 mb-6 text-center break-words">
                {message}
            </p>
            <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                <input
                    type="text"
                    name="hospitalAddress"
                    placeholder="New Hospital Wallet Address"
                    value={hospitalAddress}
                    onChange={handleInput}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                    type="text"
                    name="hospitalPubKey"
                    placeholder="Hospital ECDH X25519 Public Key (with 0x prefix)"
                    value={hospitalPubKey}
                    onChange={handleInput}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                    type="button"
                    onClick={handleButton}
                    className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition duration-200 hover:cursor-pointer"
                >
                    Update Hospital
                </button>
            </form>
        </div>
    );
};

export default UpdateHospital;
