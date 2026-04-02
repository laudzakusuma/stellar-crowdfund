# Developer Guide for Stellar Crowdfund

## Prerequisites
Pastikan sudah menginstall:

- Rust + wasm target  
  rustup target add wasm32-unknown-unknown
- Stellar CLI  
  cargo install stellar-cli --features opt
- Node.js 18+ dan npm  

---

## Setup (Manual, Tanpa Script Deploy)

### 1. Clone Repository
git clone https://github.com/laudzakusuma/stellar-crowdfund.git  
cd stellar-crowdfund

---

### 2. Install Dependencies (Frontend)
npm install

---

### 3. Generate Account Testnet
stellar keys generate --network testnet my_account

Simpan public key (contoh: GB...)

---

### 4. Build Smart Contract
cd contracts/crowdfund  
cargo build --target wasm32-unknown-unknown --release

---

### 5. Deploy Contract
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/crowdfund.wasm \
  --network testnet \
  --source my_account

Output: CONTRACT_ID (contoh: C...)  
Simpan ID ini!

---

### 6. Initialize Campaign
stellar contract invoke \
  --id <CONTRACT_ID> \
  --network testnet \
  --source my_account \
  -- initialize \
  --owner <PUBKEY> \
  --title "My Campaign" \
  --description "Help us achieve..." \
  --goal 10000000000 \
  --deadline $(expr $(date +%s) + 604800)

Keterangan:
- goal dalam stroops (1 XLM = 10,000,000 stroops)  
- deadline = +7 hari dari sekarang  

---

### 7. Setup Environment Variables

Buat file `.env.local`:

NEXT_PUBLIC_CONTRACT_ID=<CONTRACT_ID>  
NEXT_PUBLIC_STELLAR_NETWORK=TESTNET  
NEXT_PUBLIC_SOROBAN_RPC=https://soroban-testnet.stellar.org  
NEXT_PUBLIC_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

---

### 8. Run Frontend
npm run dev

---

## Generate TypeScript Bindings (Opsional)
npm run generate:abi

Output: src/contracts/  
Pastikan CONTRACT_ID sudah ada di .env.local

---

## Testing Smart Contract
cd contracts/crowdfund  
cargo test

---

## Deploy ke Vercel
npx vercel --prod

---

## package.json Script
Tambahkan:

{
  "scripts": {
    "generate:abi": "stellar contract bindings typescript --contract-id $NEXT_PUBLIC_CONTRACT_ID --network testnet --output-dir ./src/contracts"
  }
}

---

## Notes
- Pastikan wallet sudah funded di testnet  
- Simpan CONTRACT_ID dengan aman  
- Gunakan testnet untuk development  

---