import { supabase } from "../config/supabase";

const bytesToHex = (value) => Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
const toBytes = (value) => value instanceof Uint8Array ? value : new Uint8Array(value);

class WalletIdentityService {
  async list(userId) {
    const { data, error } = await supabase
      .from("identity_wallets")
      .select("id,chain,address,wallet_name,verified_at,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async link(chain, wallet, walletName = "") {
    if (!wallet || !["ethereum", "solana", "cardano"].includes(chain)) {
      throw new Error("Choose a compatible EVM, Solana, or Cardano wallet.");
    }

    let address;
    let challengeBody = { action: "challenge", chain };
    let sign;

    if (chain === "ethereum") {
      if (typeof wallet.request !== "function") {
        throw new Error("This EVM wallet cannot sign messages.");
      }
      const accounts = await wallet.request({ method: "eth_requestAccounts" });
      address = accounts?.[0];
      if (!address) throw new Error("The EVM wallet did not return an account.");
      const chainIdHex = await wallet.request({ method: "eth_chainId" });
      const chainId = Number.parseInt(chainIdHex, 16);
      challengeBody = { ...challengeBody, address, chainId };
      sign = (message) => wallet.request({
        method: "personal_sign",
        params: [bytesToHex(new TextEncoder().encode(message)).replace(/^/, "0x"), address],
      });
    } else if (chain === "solana") {
      if (typeof wallet.connect !== "function" || typeof wallet.signMessage !== "function") {
        throw new Error("This Solana wallet cannot connect and sign messages.");
      }
      const connection = wallet.publicKey ? null : await wallet.connect();
      const publicKey = wallet.publicKey || connection?.publicKey;
      address = typeof publicKey?.toBase58 === "function" ? publicKey.toBase58() : String(publicKey || "");
      if (!address) throw new Error("The Solana wallet did not return an account.");
      challengeBody = { ...challengeBody, address };
      sign = async (message) => {
        const result = await wallet.signMessage(new TextEncoder().encode(message));
        const signature = result?.signature ?? result;
        if (!signature) throw new Error("The Solana wallet did not return a signature.");
        return bytesToHex(toBytes(signature));
      };
    } else {
      if (typeof wallet.enable !== "function") {
        throw new Error("A compatible CIP-30 Cardano wallet is required.");
      }
      const api = await wallet.enable();
      if (typeof api?.signData !== "function") {
        throw new Error("This Cardano wallet does not support CIP-30 data signing.");
      }
      const used = await api.getUsedAddresses();
      const unused = typeof api.getUnusedAddresses === "function" ? await api.getUnusedAddresses() : [];
      address = used?.[0] || unused?.[0] || (typeof api.getChangeAddress === "function" ? await api.getChangeAddress() : "");
      if (!/^(?:[0-9a-f]{2})+$/i.test(address || "")) {
        throw new Error("The Cardano wallet did not return a valid address.");
      }
      challengeBody = { ...challengeBody, address };
      sign = async (message) => {
        const messageHex = bytesToHex(new TextEncoder().encode(message));
        const result = await api.signData(address, messageHex);
        if (!result?.signature || !result?.key) {
          throw new Error("The Cardano wallet returned an invalid signature.");
        }
        return { signature: result.signature, publicKey: result.key };
      };
    }

    const { data: challenge, error: challengeError } = await supabase.functions.invoke(
      "wallet-identity",
      { body: challengeBody },
    );
    if (challengeError) throw challengeError;
    if (!challenge?.challengeId || !challenge?.message) {
      throw new Error("The wallet link challenge could not be created.");
    }

    const signed = await sign(challenge.message);
    const signaturePayload = typeof signed === "string"
      ? { signature: signed }
      : signed;
    const { data, error } = await supabase.functions.invoke("wallet-identity", {
      body: {
        action: "verify",
        challengeId: challenge.challengeId,
        ...signaturePayload,
        walletName,
      },
    });
    if (error) throw error;
    if (!data?.wallet) throw new Error(data?.error || "Wallet verification did not complete.");
    return data.wallet;
  }

  async unlink(userId, walletId) {
    const { error } = await supabase
      .from("identity_wallets")
      .delete()
      .eq("user_id", userId)
      .eq("id", walletId);
    if (error) throw error;
  }
}

const walletIdentityService = new WalletIdentityService();
export default walletIdentityService;
