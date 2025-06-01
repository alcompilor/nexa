import { useState } from "react";
import spinner from "../assets/spinner.svg";
import { uploadRecord } from "../lib/encrypt";

export const AddRecord = () => {
    const [recordData, setRecordData] = useState<string>("");
    const [patientAddress, setPatientAddress] = useState<string>("");
    const [message, setMessage] = useState<string>("");
    const [showLoader, setShowLoader] = useState<boolean>(false);

    const handleInput = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        if (name === "recordData") setRecordData(value);
        if (name === "patientAddress") setPatientAddress(value);
    };

    const handleButton = async () => {
        if (recordData && patientAddress) {
            try {
                setShowLoader(true);
                const txHash = await uploadRecord(
                    patientAddress as `0x{string}`,
                    recordData
                );

                setMessage(
                    `You Have Successfully Added a Record | Receipt: ${txHash}`
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
            <p className="text-sm text-gray-600 mb-6 text-center break-words">
                {message}
            </p>
            <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                <input
                    type="text"
                    name="patientAddress"
                    placeholder="Patient Account Address (starts with 0x)"
                    value={patientAddress}
                    onChange={handleInput}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <textarea
                    name="recordData"
                    placeholder="Patient data goes here...."
                    value={recordData}
                    onChange={handleInput}
                    rows={10}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                    type="button"
                    onClick={handleButton}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-200 hover:cursor-pointer"
                >
                    Add Record
                </button>
            </form>
        </div>
    );
};

export default AddRecord;
