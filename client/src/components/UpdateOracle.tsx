import { useState } from "react";
import { writeToContract } from "../lib/viemHelpers";
import spinner from "../assets/spinner.svg";

export const UpdateOracle = () => {
    const [oraclePubKey, setOraclePubKey] = useState<string>("");
    const [selectedOracle, setSelectedOracle] = useState<number>(0);
    const [message, setMessage] = useState<string>("");
    const [showLoader, setShowLoader] = useState<boolean>(false);

    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (name === "oraclePubKey") setOraclePubKey(value);
    };

    const handleButton = async () => {
        if (oraclePubKey) {
            try {
                setShowLoader(true);
                const txHash = await writeToContract({
                    functionName: "updateOraclePubKey",
                    args: [selectedOracle, oraclePubKey],
                });

                setMessage(`Oracle Successfully Updated | Receipt: ${txHash}`);
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
                <div className="flex space-x-4">
                    {[0, 1].map((option) => (
                        <label
                            key={option}
                            className={`cursor-pointer px-4 py-2 rounded-lg border-2 text-center w-32 transition-all duration-200
                    ${
                        selectedOracle === option
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-gray-800 border-gray-300 hover:border-blue-500"
                    }`}
                        >
                            <input
                                type="radio"
                                name="custom-radio"
                                value={option}
                                checked={selectedOracle === option}
                                onChange={() => setSelectedOracle(option)}
                                className="hidden"
                            />
                            {option === 0 ? "Oracle 1" : "Oracle 2"}
                        </label>
                    ))}
                </div>
                <input
                    type="text"
                    name="oraclePubKey"
                    placeholder={`Oracle ${
                        selectedOracle + 1
                    } ECDH X25519 Public Key (with 0x prefix)`}
                    value={oraclePubKey}
                    onChange={handleInput}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                    type="button"
                    onClick={handleButton}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-200 hover:cursor-pointer"
                >
                    Update Oracle {selectedOracle + 1}
                </button>
            </form>
        </div>
    );
};

export default UpdateOracle;
