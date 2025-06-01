import AddRecord from "../components/AddRecord";
import { SectionCard } from "../components/SectionCard";

export const PhysicianPortal = () => {
    return (
        <div className="min-h-screen bg-gray-50 px-4 py-10">
            <div className="max-w-lg mx-auto space-y-8">
                <h1 className="text-4xl font-bold text-center text-gray-700">
                    Physician Portal at Hospital
                </h1>

                <div className="flex flex-col gap-10">
                    <SectionCard title="Add a Patient Record">
                        <AddRecord />
                    </SectionCard>
                </div>
            </div>
        </div>
    );
};

export default PhysicianPortal;
