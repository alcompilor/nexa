import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
// import Doctor from "../pages/doctor";
// import Patient from "../pages/patient";
import ConnectButton from "./components/ConnectButton";

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
                <div>
                    <Link to="/doctor" style={{ marginRight: "1rem" }}>
                        Doctor
                    </Link>
                    <Link to="/patient">Patient</Link>
                </div>
                <ConnectButton />
            </nav>

            <Routes>
                {/* <Route path="/doctor" element={<Doctor />} />
                <Route path="/patient" element={<Patient />} /> */}
            </Routes>
        </Router>
    );
};

export default App;
