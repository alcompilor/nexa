import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Doctor from '../pages/doctor';
import Patient from '../pages/patient';
import ConnectButton from './components/ConnectButton';
import { useEffect } from 'react';
import { uploadRecord } from './lib/encrypt';

const App = () => {
    useEffect(() => {
        (async() => {
            uploadRecord('0x6CcEcD81C38816D0A96431Ca5A231A0497C00d8A');
        })();
    }, [])
  return (
    <Router>
      <nav style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: '#f3f4f6' }}>
        <div>
          <Link to="/doctor" style={{ marginRight: '1rem' }}>Doctor</Link>
          <Link to="/patient">Patient</Link>
        </div>
        <ConnectButton />
      </nav>

      <Routes>
        <Route path="/doctor" element={<Doctor />} />
        <Route path="/patient" element={<Patient />} />
      </Routes>
    </Router>
  );
};

export default App;
