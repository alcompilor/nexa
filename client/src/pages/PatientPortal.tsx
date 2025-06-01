import AccessRecord from "../components/AccessRecord";
import AddPatient from "../components/AddPatient";
import RevokePatient from "../components/RevokePatient";
import { SectionCard } from "../components/SectionCard";
import { usePatientPrivKeyStore } from "../stores/usePatientPrivKeyStore";

export const PatientPortal = () => {
    const { privKey } = usePatientPrivKeyStore();

    return (
        <div className="min-h-screen bg-gray-50 px-4 py-10">
            <div className="max-w-lg mx-auto space-y-8">
                <h1 className="text-4xl font-bold text-center text-gray-700">
                    Patient Portal at Hospital
                </h1>

                <div className="flex flex-col gap-10">
                    {privKey && (
                        <SectionCard title="Fetch Patient Record">
                            <AccessRecord />
                        </SectionCard>
                    )}
                    <SectionCard title="Self-Register as Patient">
                        <AddPatient />
                    </SectionCard>
                    <SectionCard title="Cancel Patient Registration">
                        <RevokePatient />
                    </SectionCard>
                </div>
            </div>
        </div>
    );
};

export default PatientPortal;
