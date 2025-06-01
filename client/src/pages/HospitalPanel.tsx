import AddPhysician from "../components/AddPhysician";
import RevokePhysician from "../components/RevokePhysician";
import { SectionCard } from "../components/SectionCard";
import UpdateHospital from "../components/UpdateHospital";
import UpdateOracle from "../components/UpdateOracle";

export const HospitalPanel = () => {
    return (
        <div className="min-h-screen bg-gray-50 px-4 py-10">
            <div className="max-w-5xl mx-auto space-y-8">
                <h1 className="text-4xl font-bold text-center text-gray-700">
                    Hospital Admin Portal
                </h1>

                <div className="grid md:grid-cols-2 gap-10">
                    <SectionCard title="Add Physician">
                        <AddPhysician />
                    </SectionCard>

                    <SectionCard title="Revoke Physician">
                        <RevokePhysician />
                    </SectionCard>

                    <SectionCard title="Update Oracle Public Keys">
                        <UpdateOracle />
                    </SectionCard>

                    <SectionCard title="Update Hospital Access">
                        <UpdateHospital />
                    </SectionCard>
                </div>
            </div>
        </div>
    );
};

export default HospitalPanel;
