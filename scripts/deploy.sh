#!/bin/bash
# ============================================================
# deploy.sh — Deploy Soroban Crowdfund Contract to Testnet
# ============================================================
# Prerequisites:
#   1. Install Rust: https://rustup.rs
#   2. Install Stellar CLI: cargo install --locked stellar-cli --features opt
#   3. Add wasm target: rustup target add wasm32-unknown-unknown
# ============================================================

set -e  # Exit on any error

# ── Config ──────────────────────────────────────────────────
NETWORK="testnet"
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
RPC_URL="https://soroban-testnet.stellar.org"
IDENTITY="deployer"       # Name for your key in Stellar CLI
CAMPAIGN_TITLE="Save the Ocean"
CAMPAIGN_DESCRIPTION="Help us fund ocean cleanup initiatives using Stellar blockchain"
CAMPAIGN_GOAL_XLM=1000    # Goal in XLM
CAMPAIGN_DAYS=30          # Campaign duration in days

# ── Colors ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BOLD}${CYAN}"
echo "╔══════════════════════════════════════════════╗"
echo "║     Stellar Crowdfund — Deploy Script        ║"
echo "║     Yellow Belt · Soroban Testnet            ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Step 1: Check Prerequisites ─────────────────────────────
echo -e "${YELLOW}[1/6] Checking prerequisites...${NC}"

if ! command -v stellar &> /dev/null; then
    echo -e "${RED}❌ Stellar CLI not found. Install it with:${NC}"
    echo "    cargo install --locked stellar-cli --features opt"
    exit 1
fi

if ! rustup target list --installed | grep -q "wasm32-unknown-unknown"; then
    echo -e "${YELLOW}⚙️  Adding wasm32 target...${NC}"
    rustup target add wasm32-unknown-unknown
fi

echo -e "${GREEN}✅ Prerequisites OK${NC}"

# ── Step 2: Configure Network ────────────────────────────────
echo -e "${YELLOW}[2/6] Configuring Stellar testnet...${NC}"

stellar network add testnet \
    --rpc-url "$RPC_URL" \
    --network-passphrase "$NETWORK_PASSPHRASE" \
    2>/dev/null || echo "  (testnet already configured)"

echo -e "${GREEN}✅ Network configured${NC}"

# ── Step 3: Create/Fund Identity ────────────────────────────
echo -e "${YELLOW}[3/6] Setting up identity '$IDENTITY'...${NC}"

if ! stellar keys show "$IDENTITY" &>/dev/null; then
    echo "  Creating new keypair '$IDENTITY'..."
    stellar keys generate "$IDENTITY" --network testnet
    echo "  Funding via Friendbot..."
    stellar keys fund "$IDENTITY" --network testnet
    echo -e "${GREEN}✅ Identity created and funded${NC}"
else
    echo "  Identity '$IDENTITY' already exists"
    stellar keys fund "$IDENTITY" --network testnet 2>/dev/null || true
    echo -e "${GREEN}✅ Identity funded${NC}"
fi

OWNER_ADDRESS=$(stellar keys address "$IDENTITY")
echo -e "  Owner address: ${CYAN}$OWNER_ADDRESS${NC}"

# ── Step 4: Build Contract ───────────────────────────────────
echo -e "${YELLOW}[4/6] Building Soroban contract (release)...${NC}"

stellar contract build \
    --package crowdfund \
    --release

WASM_PATH="target/wasm32-unknown-unknown/release/crowdfund.wasm"

if [ ! -f "$WASM_PATH" ]; then
    echo -e "${RED}❌ Build failed: $WASM_PATH not found${NC}"
    exit 1
fi

WASM_SIZE=$(du -k "$WASM_PATH" | cut -f1)
echo -e "${GREEN}✅ Contract built (${WASM_SIZE}KB)${NC}"

# ── Step 5: Deploy Contract ──────────────────────────────────
echo -e "${YELLOW}[5/6] Deploying contract to testnet...${NC}"

CONTRACT_ID=$(stellar contract deploy \
    --wasm "$WASM_PATH" \
    --source "$IDENTITY" \
    --network "$NETWORK" \
    --fee 1000000)

echo -e "${GREEN}✅ Contract deployed!${NC}"
echo -e "  Contract ID: ${CYAN}$CONTRACT_ID${NC}"

# ── Step 6: Initialize Campaign ─────────────────────────────
echo -e "${YELLOW}[6/6] Initializing campaign...${NC}"

# Calculate deadline (now + N days in unix timestamp)
DEADLINE=$(( $(date +%s) + CAMPAIGN_DAYS * 86400 ))

# Convert XLM goal to stroops (1 XLM = 10,000,000 stroops)
GOAL_STROOPS=$(( CAMPAIGN_GOAL_XLM * 10000000 ))

stellar contract invoke \
    --id "$CONTRACT_ID" \
    --source "$IDENTITY" \
    --network "$NETWORK" \
    --fee 1000000 \
    -- initialize \
    --owner "$OWNER_ADDRESS" \
    --title "$CAMPAIGN_TITLE" \
    --description "$CAMPAIGN_DESCRIPTION" \
    --goal "$GOAL_STROOPS" \
    --deadline "$DEADLINE"

echo -e "${GREEN}✅ Campaign initialized!${NC}"

# ── Output ───────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}"
echo "╔══════════════════════════════════════════════╗"
echo "║             🚀 Deployment Complete!          ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "  ${BOLD}Contract ID:${NC}    ${CYAN}$CONTRACT_ID${NC}"
echo -e "  ${BOLD}Owner:${NC}          ${CYAN}$OWNER_ADDRESS${NC}"
echo -e "  ${BOLD}Network:${NC}        Stellar Testnet"
echo -e "  ${BOLD}Goal:${NC}           $CAMPAIGN_GOAL_XLM XLM"
echo -e "  ${BOLD}Duration:${NC}       $CAMPAIGN_DAYS days"
echo ""
echo -e "  ${BOLD}Explorer:${NC}"
echo -e "  ${CYAN}https://stellar.expert/explorer/testnet/contract/$CONTRACT_ID${NC}"
echo ""
echo -e "${YELLOW}📝 Next: Update your .env.local:${NC}"
echo -e "  NEXT_PUBLIC_CONTRACT_ID=$CONTRACT_ID"
echo ""

# Auto-update .env.local if it exists
if [ -f ".env.local" ]; then
    if grep -q "NEXT_PUBLIC_CONTRACT_ID" .env.local; then
        sed -i.bak "s|NEXT_PUBLIC_CONTRACT_ID=.*|NEXT_PUBLIC_CONTRACT_ID=$CONTRACT_ID|" .env.local
        echo -e "${GREEN}✅ .env.local updated automatically!${NC}"
    else
        echo "NEXT_PUBLIC_CONTRACT_ID=$CONTRACT_ID" >> .env.local
        echo -e "${GREEN}✅ CONTRACT_ID appended to .env.local${NC}"
    fi
else
    cp .env.example .env.local
    sed -i.bak "s|NEXT_PUBLIC_CONTRACT_ID=.*|NEXT_PUBLIC_CONTRACT_ID=$CONTRACT_ID|" .env.local
    echo -e "${GREEN}✅ .env.local created from .env.example${NC}"
fi

echo ""
echo -e "${BOLD}Run the frontend:${NC}"
echo "  npm install && npm run dev"
echo ""
