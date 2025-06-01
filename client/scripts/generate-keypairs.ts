// scripts/generate-keypair.ts
import { x25519 } from '@noble/curves/ed25519';

const privateKey = x25519.utils.randomPrivateKey();
const publicKey = x25519.getPublicKey(privateKey);

console.log('✅ ECDH X25519 Key Pair');
console.log('Public Key (hex):', Buffer.from(publicKey).toString('hex'));
console.log('Private Key (hex):', Buffer.from(privateKey).toString('hex'));
