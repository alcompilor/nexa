import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import HospitalPanel from "./pages/HospitalPanel";
import PatientPortal from "./pages/PatientPortal";
import PhysicianPortal from "./pages/PhysicianPortal";

const App = () => {
    return (
        <Router>
            <nav className="flex justify-between items-center px-6 py-4 bg-gray-100 shadow-md">
                <div className="flex gap-6 text-gray-700 font-medium">
                    <Link
                        to="/hospital"
                        className="hover:text-blue-600 transition-colors"
                    >
                        Hospital Panel
                    </Link>
                    <Link
                        to="/physicianportal"
                        className="hover:text-blue-600 transition-colors"
                    >
                        Physician Portal
                    </Link>
                    <Link
                        to="/patientportal"
                        className="hover:text-blue-600 transition-colors"
                    >
                        Patient Portal
                    </Link>
                </div>
            </nav>

            <Routes>
                <Route
                    path="/"
                    element={
                        <main className="flex justify-center items-center h-[calc(100vh-80px)] bg-white">
                            <h1 className="text-4xl font-semibold text-gray-800">
                                Welcome to NexaEHR 🧬
                            </h1>
                        </main>
                    }
                />
                <Route path="/hospital" element={<HospitalPanel />} />
                <Route path="/patientportal" element={<PatientPortal />} />
                <Route path="/physicianportal" element={<PhysicianPortal />} />
            </Routes>
        </Router>
    );
};

export default App;
