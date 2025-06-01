import { useState } from "react";
import spinner from "../assets/spinner.svg";
import { fetchRecord } from "../lib/decrypt";

export const AccessRecord = () => {
    const [recordIndex, setRecordIndex] = useState<number>();
    const [recordData, setRecordData] = useState<string>();
    const [message, setMessage] = useState<string>("");
    const [showLoader, setShowLoader] = useState<boolean>(false);

    const handleInput = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        if (name === "recordIndex") setRecordIndex(+value);
    };

    const handleButton = async () => {
        try {
            setShowLoader(true);
            const data = recordIndex
                ? await fetchRecord(recordIndex - 1)
                : await fetchRecord();
            setRecordData(data);

            setMessage(`You Have Successfully Fetched The Record`);
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
                <input
                    type="number"
                    name="recordIndex"
                    placeholder="Record # (leave blank for latest)"
                    value={recordIndex}
                    onChange={handleInput}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {recordData && (
                    <textarea
                        name="recordData"
                        value={recordData}
                        disabled={true}
                        rows={12}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-not-allowed bg-gray-100"
                    />
                )}
                <button
                    type="button"
                    onClick={handleButton}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-200 hover:cursor-pointer"
                >
                    Get Record
                </button>
            </form>
        </div>
    );
};

export default AccessRecord;
