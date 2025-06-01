import { useState } from "react";
import { writeToContract } from "../lib/viemHelpers";
import { usePatientPrivKeyStore } from "../stores/usePatientPrivKeyStore";
import spinner from "../assets/spinner.svg";

export const RevokePatient = () => {
    const [message, setMessage] = useState<string>("");
    const [showLoader, setShowLoader] = useState<boolean>(false);

    const { clearPrivKey } = usePatientPrivKeyStore();
    const handleButton = async () => {
        try {
            setShowLoader(true);
            const txHash = await writeToContract({
                functionName: "revokePatient",
            });
            clearPrivKey();

            setMessage(`Patient Status Revoked | Receipt: ${txHash}`);
        } catch (error: unknown) {
            setMessage(`${error}`);
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
                <button
                    type="button"
                    onClick={handleButton}
                    className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition duration-200 hover:cursor-pointer"
                >
                    Leave the Patient Registry
                </button>
            </form>
        </div>
    );
};

export default RevokePatient;
