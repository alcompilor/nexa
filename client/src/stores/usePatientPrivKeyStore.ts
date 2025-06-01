// stores/patientPrivKeyStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PatientPrivKeyStore {
    privKey: string | null;
    setPrivKey: (key: string) => void;
    clearPrivKey: () => void;
}

export const usePatientPrivKeyStore = create<PatientPrivKeyStore>()(
    persist(
        (set) => ({
            privKey: null,
            setPrivKey: (key) => set({ privKey: key }),
            clearPrivKey: () => set({ privKey: null }),
        }),
        {
            name: "PATIENT_PRIVKEY",
        }
    )
);
