import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import HospitalPanel from "./pages/HospitalPanel";
import PatientPortal from "./pages/PatientPortal";
import PhysicianPortal from "./pages/PhysicianPortal";

const App = () => {
    return (
        <Router>
            <nav className="flex justify-between items-center px-6 py-4 bg-blue-900 shadow-md">
                <div className="flex gap-6 text-white font-semibold text-xl">
                    <Link
                        to="/"
                        className="hover:text-blue-300 transition-colors"
                    >
                        Home
                    </Link>
                    <Link
                        to="/hospital"
                        className="hover:text-blue-300 transition-colors"
                    >
                        Hospital Panel
                    </Link>
                    <Link
                        to="/physicianportal"
                        className="hover:text-blue-300 transition-colors"
                    >
                        Physician Portal
                    </Link>
                    <Link
                        to="/patientportal"
                        className="hover:text-blue-300 transition-colors"
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
                            <h1 className="text-6xl font-bold text-gray-800">
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
