import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
// import Doctor from "../pages/doctor";
// import Patient from "../pages/patient";
import ConnectButton from "./components/ConnectButton";
import HospitalPanel from "./pages/HospitalPanel";
import PatientPortal from "./pages/PatientPortal";
import PhysicianPortal from "./pages/PhysicianPortal";

const App = () => {
    return (
        <Router>
            <nav
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "1rem",
                    background: "#f3f4f6",
                }}
            >
                <div className="flex gap-4">
                    <Link to="/hospital">Hospital Panel</Link>
                    <Link to="/physicianportal">Physician Portal</Link>
                    <Link to="/patientportal">Patient Portal</Link>
                </div>
                <ConnectButton />
            </nav>

            <Routes>
                <Route path="/hospital" element={<HospitalPanel />} />
                <Route path="/patientportal" element={<PatientPortal />} />
                <Route path="/physicianportal" element={<PhysicianPortal />} />
            </Routes>
        </Router>
    );
};

export default App;
