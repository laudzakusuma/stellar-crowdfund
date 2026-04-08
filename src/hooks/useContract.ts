"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import * as StellarSdk from "@stellar/stellar-sdk";
import {
  campaignCache,
  donationCache,
  eventsCache,
  createCacheKey,
} from "@/lib/cache";

const CONTRACT_ID =
  process.env.NEXT_PUBLIC_CONTRACT_ID ||
  "CBCYFVAVRA3PSMY7TIAXQAWWYZX5MGM5OKGPJB33EHXY3POQ5K4674R4";
const RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC || "https://soroban-testnet.stellar.org";

const READ_ONLY_ACCOUNT =
  "GAKXVPOXZEM2BFZ7FIISOO2PKQ437QH2TIRBH6A5YCAOQESTQHKGV2MJ";

export interface Campaign {
  title: string;
  description: string;
  goal: bigint;
  raised: bigint;
  deadline: bigint;
  owner: string;
  withdrawn: boolean;
  donor_count: number;
}

export interface DonationEvent {
  id: string;
  donor: string;
  amount: bigint;
  total_raised: bigint;
  ledger: number;
  timestamp: number;
}

export function useContract() {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<DonationEvent[]>([]);
  const [myDonation, setMyDonation] = useState<bigint>(0n);
  const [isFetching, setIsFetching] = useState(false);
  const lastLedgerRef = useRef<number>(0);

  const server = new StellarSdk.rpc.Server(RPC_URL);
  const CAMPAIGN_KEY = createCacheKey("campaign", CONTRACT_ID);

  const invalidateCache = useCallback((donorAddress?: string) => {
    campaignCache.delete(CAMPAIGN_KEY);
    eventsCache.delete(createCacheKey("events", CONTRACT_ID));
    if (donorAddress) {
      donationCache.delete(createCacheKey("donor", CONTRACT_ID, donorAddress));
    }
  }, [CAMPAIGN_KEY]);

  const fetchCampaign = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = campaignCache.get(CAMPAIGN_KEY) as Campaign | null;
      if (cached) {
        setCampaign(cached);
        setLoading(false);
        return;
      }
    }

    setIsFetching(true);
    try {
      const contract = new StellarSdk.Contract(CONTRACT_ID);
      const account = await server.getAccount(READ_ONLY_ACCOUNT);
      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(contract.call("get_campaign"))
        .setTimeout(30)
        .build();

      const simResult = await server.simulateTransaction(tx);
      if (StellarSdk.rpc.Api.isSimulationSuccess(simResult)) {
        const raw = StellarSdk.scValToNative(simResult.result!.retval);
        const data: Campaign = {
          title: raw.title || "Stellar Crowdfund Campaign",
          description: raw.description || "",
          goal: BigInt(raw.goal ?? 0),
          raised: BigInt(raw.raised ?? 0),
          deadline: BigInt(raw.deadline ?? 0),
          owner: raw.owner || "",
          withdrawn: Boolean(raw.withdrawn),
          donor_count: Number(raw.donor_count ?? 0),
        };
        campaignCache.set(CAMPAIGN_KEY, data);
        setCampaign(data);
        setError(null);
      }
    } catch (err: any) {
      if (
        err?.message?.includes("not initialized") ||
        err?.message?.includes("MissingValue")
      ) {
        setError("Contract not initialized. Deploy and initialize first.");
      } else {
        console.error("fetchCampaign:", err);
        setError("Failed to load campaign data.");
      }
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  }, []);

  const fetchMyDonation = useCallback(async (address: string) => {
    const key = createCacheKey("donor", CONTRACT_ID, address);
    const cached = donationCache.get(key);
    if (cached !== null) {
      setMyDonation(cached);
      return;
    }

    try {
      const contract = new StellarSdk.Contract(CONTRACT_ID);
      const account = await server.getAccount(READ_ONLY_ACCOUNT);
      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          contract.call(
            "get_donation",
            StellarSdk.nativeToScVal(address, { type: "address" })
          )
        )
        .setTimeout(30)
        .build();

      const simResult = await server.simulateTransaction(tx);
      if (StellarSdk.rpc.Api.isSimulationSuccess(simResult)) {
        const val = BigInt(
          StellarSdk.scValToNative(simResult.result!.retval) ?? 0
        );
        donationCache.set(key, val);
        setMyDonation(val);
      }
    } catch (err) {
      console.error("fetchMyDonation:", err);
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    const EVENTS_KEY = createCacheKey("events", CONTRACT_ID);
    const cached = eventsCache.get(EVENTS_KEY);
    if (cached && (cached as any[]).length > 0) {
      setEvents(cached as DonationEvent[]);
    }

    try {
      const ledgerResp = await server.getLatestLedger();
      const currentLedger = ledgerResp.sequence;
      const startLedger = Math.max(1, currentLedger - 1000);
      if (startLedger <= lastLedgerRef.current) return;

      const resp = await server.getEvents({
        startLedger,
        filters: [{ type: "contract", contractIds: [CONTRACT_ID] }],
        limit: 50,
      });

      const newEvents: DonationEvent[] = [];
      for (const ev of resp.events ?? []) {
        const topicStr = ev.topic.map((t: any) => {
          try { return StellarSdk.scValToNative(t); } catch { return ""; }
        });
        if (topicStr[0] === "donated") {
          try {
            const value = StellarSdk.scValToNative(ev.value);
            newEvents.push({
              id: ev.id,
              donor: String(topicStr[1] || "Unknown"),
              amount: BigInt(Array.isArray(value) ? value[0] : value ?? 0),
              total_raised: BigInt(Array.isArray(value) ? value[1] : 0),
              ledger: ev.ledger,
              timestamp: Date.now(),
            });
          } catch {}
        }
      }

      if (newEvents.length > 0) {
        setEvents((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const unique = newEvents.filter((e) => !existingIds.has(e.id));
          const merged = [...unique, ...prev].slice(0, 20);
          eventsCache.set(EVENTS_KEY, merged);
          return merged;
        });
        lastLedgerRef.current = currentLedger;
      }
    } catch (err) {
      console.error("fetchEvents:", err);
    }
  }, []);

  const buildDonateXDR = useCallback(
    async (address: string, amountXLM: number): Promise<string> => {
      const contract = new StellarSdk.Contract(CONTRACT_ID);
      const account = await server.getAccount(address);
      const amountStroops = BigInt(Math.round(amountXLM * 10_000_000));

      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: "100000",
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          contract.call(
            "donate",
            StellarSdk.nativeToScVal(address, { type: "address" }),
            StellarSdk.nativeToScVal(amountStroops, { type: "i128" })
          )
        )
        .setTimeout(60)
        .build();

      const simResult = await server.simulateTransaction(tx);
      if (!StellarSdk.rpc.Api.isSimulationSuccess(simResult)) {
        const errMsg = (simResult as any).error || "Simulation failed";
        if (errMsg.toLowerCase().includes("insufficient"))
          throw new Error("insufficient_balance");
        throw new Error(errMsg);
      }

      const preparedTx = StellarSdk.rpc.assembleTransaction(
        tx,
        simResult
      ).build();
      return preparedTx.toXDR();
    },
    []
  );

  useEffect(() => {
    fetchCampaign();
    const interval = setInterval(() => fetchCampaign(true), 5000);
    return () => clearInterval(interval);
  }, [fetchCampaign]);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 8000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  return {
    campaign,
    loading,
    error,
    events,
    myDonation,
    isFetching,
    fetchCampaign,
    fetchMyDonation,
    fetchEvents,
    buildDonateXDR,
    invalidateCache,
  };
}