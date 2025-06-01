import { useWallet } from '../../hooks/useWallet';

const ConnectButton = () => {
  const { connectWallet } = useWallet();

  return (
    <button onClick={connectWallet} style={{ padding: '10px', backgroundColor: '#1e40af', color: 'white', border: 'none', borderRadius: '4px' }}>
      Connect Wallet
    </button>
  );
};

export default ConnectButton;
