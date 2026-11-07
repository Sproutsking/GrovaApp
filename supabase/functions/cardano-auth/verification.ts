import * as CML from "@emurgo/cardano-message-signing";
import { blake2b } from "@noble/hashes/blake2.js";
import { bech32 } from "@scure/base";

const encoder = new TextEncoder();

function decodeHex(value: string, field: string, maxBytes: number): Uint8Array {
  if (!/^(?:[0-9a-f]{2})+$/i.test(value) || value.length / 2 > maxBytes) {
    throw new Error(`Invalid ${field}.`);
  }
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i += 1) mismatch |= left[i] ^ right[i];
  return mismatch === 0;
}

export function parseAddress(addressHex: string) {
  const bytes = decodeHex(addressHex, "Cardano address", 128);
  if (bytes.length < 29) throw new Error("Malformed Cardano address.");

  const addressType = bytes[0] >> 4;
  const networkId = bytes[0] & 0x0f;
  if (![0, 2, 4, 6].includes(addressType)) {
    throw new Error(
      "This Cardano address cannot authenticate with a payment key.",
    );
  }
  if (
    ([0, 2].includes(addressType) && bytes.length !== 57) ||
    (addressType === 6 && bytes.length !== 29)
  ) {
    throw new Error("Malformed Cardano address.");
  }
  if (addressType === 4) {
    let offset = 29;
    for (let component = 0; component < 3; component += 1) {
      let terminated = false;
      for (let byteIndex = 0; byteIndex < 10; byteIndex += 1) {
        if (offset >= bytes.length) {
          throw new Error("Malformed Cardano pointer address.");
        }
        const byte = bytes[offset++];
        if ((byte & 0x80) === 0) {
          terminated = true;
          break;
        }
      }
      if (!terminated) {
        throw new Error("Malformed Cardano pointer address.");
      }
    }
    if (offset !== bytes.length) {
      throw new Error("Malformed Cardano pointer address.");
    }
  }

  return {
    bytes,
    addressHex: toHex(bytes),
    canonicalAddress: bech32.encode(
      networkId === 1 ? "addr" : "addr_test",
      bech32.toWords(bytes),
      1024,
    ),
    networkId,
    paymentKeyHash: bytes.slice(1, 29),
  };
}

export async function verifyCip8Signature(
  addressBytes: Uint8Array,
  expectedMessage: string,
  keyHex: string,
  signatureHex: string,
  expectedPaymentKeyHash: Uint8Array,
): Promise<boolean> {
  const keyBytes = decodeHex(keyHex, "CIP-8 key", 512);
  const coseBytes = decodeHex(signatureHex, "CIP-8 signature", 2048);
  const coseKey = CML.COSEKey.from_bytes(keyBytes);
  const coseSign1 = CML.COSESign1.from_bytes(coseBytes);
  const xLabelInt = CML.Int.new_i32(-2);
  const xLabel = CML.Label.new_int(xLabelInt);
  const publicKeyValue = coseKey.header(xLabel);
  let sigStructure: ReturnType<typeof coseSign1.signed_data> | undefined;

  try {
    const rawPublicKeyBytes = publicKeyValue?.as_bytes();
    if (!rawPublicKeyBytes || rawPublicKeyBytes.length !== 32) return false;
    const publicKeyBytes = Uint8Array.from(rawPublicKeyBytes);

    const publicKeyHash = blake2b(publicKeyBytes, { dkLen: 28 });
    if (!equalBytes(publicKeyHash, expectedPaymentKeyHash)) return false;

    const payload = coseSign1.payload();
    if (!payload || !equalBytes(payload, encoder.encode(expectedMessage))) {
      return false;
    }

    sigStructure = coseSign1.signed_data(addressBytes);
    const signedData = Uint8Array.from(sigStructure.to_bytes());
    const verificationKey = await crypto.subtle.importKey(
      "raw",
      publicKeyBytes,
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    const signature = Uint8Array.from(coseSign1.signature());
    return await crypto.subtle.verify(
      { name: "Ed25519" },
      verificationKey,
      signature,
      signedData,
    );
  } finally {
    sigStructure?.free();
    publicKeyValue?.free();
    xLabel.free();
    xLabelInt.free();
    coseSign1.free();
    coseKey.free();
  }
}
