import { useState } from "react";
import { writeToContract } from "../lib/viemHelpers";
import spinner from "../assets/spinner.svg";

export const RevokePhysician = () => {
    const [physicianAddress, setPhysicianAddress] = useState<string>("");
    const [message, setMessage] = useState<string>("");
    const [showLoader, setShowLoader] = useState<boolean>(false);

    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (name === "physicianAddress") setPhysicianAddress(value);
    };

    const handleButton = async () => {
        if (physicianAddress) {
            try {
                setShowLoader(true);
                const txHash = await writeToContract({
                    functionName: "revokePhysician",
                    args: [physicianAddress],
                });

                setMessage(`Physician Revoked | Receipt: ${txHash}`);
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
                    name="physicianAddress"
                    placeholder="Physician Wallet Address"
                    value={physicianAddress}
                    onChange={handleInput}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                    type="button"
                    onClick={handleButton}
                    className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition duration-200 hover:cursor-pointer"
                >
                    Revoke Physician
                </button>
            </form>
        </div>
    );
};

export default RevokePhysician;
