import { supabase } from "./config/supabase";

const TIER_SUPPLIES = {
  Silver: 900,
  Gold: 300,
  Diamond: 150,
  VIP: 50,
};

const CSV_HEADERS = [
  "tier",
  "serial",
  "supply",
  "serial_display",
  "card_code",
  "list_price",
  "status",
  "owner_id",
  "issued_at",
];
const CARD_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function isValidCardCode(code) {
  const compact = code.replace("-", "");
  if (!/^[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(code)) return false;
  let checksum = 0;
  for (let index = 0; index < 9; index += 1) {
    const characterIndex = CARD_CODE_ALPHABET.indexOf(compact[index]);
    if (characterIndex < 0) return false;
    checksum += (index + 1) * characterIndex;
  }
  return compact[9] === CARD_CODE_ALPHABET[checksum % CARD_CODE_ALPHABET.length];
}

function parseCsvRow(line) {
  const fields = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      fields.push(field);
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("The founders-card CSV contains an unclosed quote.");
  fields.push(field);
  return fields;
}

export function parseFoundersCardsCsv(csvText) {
  if (typeof csvText !== "string" || !csvText.trim()) {
    throw new Error("Choose the founders_cards.csv registry file.");
  }

  const lines = csvText.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  const headers = parseCsvRow(lines.shift()).map((value) => value.trim());
  if (headers.length !== CSV_HEADERS.length || headers.some((value, index) => value !== CSV_HEADERS[index])) {
    throw new Error("This file is not the expected founders_cards.csv registry.");
  }

  const rows = lines.map((line, index) => {
    const values = parseCsvRow(line);
    if (values.length !== headers.length) {
      throw new Error(`Registry row ${index + 2} has an unexpected number of columns.`);
    }
    const item = Object.fromEntries(headers.map((header, column) => [header, values[column].trim()]));
    const supply = TIER_SUPPLIES[item.tier];
    const serial = Number(item.serial);

    if (!supply || !Number.isInteger(serial) || serial < 1 || serial > supply) {
      throw new Error(`Registry row ${index + 2} has an invalid tier or serial number.`);
    }
    if (
      Number(item.supply) !== supply ||
      item.serial_display !== `#${String(serial).padStart(6, "0")}/${String(supply).padStart(4, "0")}` ||
      !isValidCardCode(item.card_code) ||
      Number(item.list_price) !== ({ Silver: 12, Gold: 25, Diamond: 50, VIP: 100 })[item.tier] ||
      item.status !== "available" ||
      item.owner_id !== "" ||
      item.issued_at !== ""
    ) {
      throw new Error(`Registry row ${index + 2} does not match the supplied unissued card registry.`);
    }

    return {
      tier: item.tier,
      serial,
      supply,
      serial_display: item.serial_display,
      card_code: item.card_code,
      list_price: Number(item.list_price),
      status: item.status,
      owner_id: null,
      issued_at: null,
    };
  });

  if (rows.length !== 1400) {
    throw new Error(`Expected 1,400 cards in the registry; found ${rows.length}.`);
  }

  const seenCodes = new Set();
  const serialsByTier = Object.fromEntries(Object.keys(TIER_SUPPLIES).map((tier) => [tier, new Set()]));
  for (const row of rows) {
    if (seenCodes.has(row.card_code)) {
      throw new Error("The registry contains a duplicate card code.");
    }
    if (serialsByTier[row.tier].has(row.serial)) {
      throw new Error(`The registry contains a duplicate ${row.tier} serial.`);
    }
    seenCodes.add(row.card_code);
    serialsByTier[row.tier].add(row.serial);
  }

  for (const [tier, supply] of Object.entries(TIER_SUPPLIES)) {
    const serials = serialsByTier[tier];
    if (serials.size !== supply || Math.min(...serials) !== 1 || Math.max(...serials) !== supply) {
      throw new Error(`The registry must contain every ${tier} serial from 1 to ${supply}.`);
    }
  }

  return rows;
}

async function callRpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message || `Could not complete ${name}.`);
  return data;
}

export const foundersCardService = {
  getCatalog() {
    return callRpc("get_founders_card_catalog");
  },

  subscribeToCatalogUpdates(onUpdate, onStatus) {
    const channel = supabase
      .channel("founders-card-catalog", { config: { private: true } })
      .on("broadcast", { event: "catalog_updated" }, ({ payload }) => onUpdate(payload))
      .subscribe((status) => {
        onStatus?.(status);
        if (status === "SUBSCRIBED") onUpdate();
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  },

  getMyCards() {
    return callRpc("get_my_founders_cards");
  },

  getAdminConfig() {
    return callRpc("admin_get_founders_card_config");
  },

  importRegistry(cards) {
    return callRpc("admin_import_founders_cards", { p_cards: cards });
  },

  updateTier(tier, settings) {
    return callRpc("admin_update_founders_card_tier", {
      p_tier: tier,
      p_list_price: Number(settings.list_price),
      p_currency: settings.price_currency || null,
      p_max_per_user: Number(settings.max_per_user),
      p_sale_enabled: Boolean(settings.sale_enabled),
      p_transfers_enabled: Boolean(settings.transfers_enabled),
    });
  },

  updatePolicy(settings) {
    return callRpc("admin_update_founders_card_policy", {
      p_reservation_hours: Number(settings.reservation_hours),
      p_late_paystack_action: settings.late_paystack_action,
    });
  },

  reservePurchase(tier, quantity, provider, idempotencyKey = crypto.randomUUID()) {
    return callRpc("reserve_founders_card_purchase", {
      p_tier: tier,
      p_quantity: Number(quantity),
      p_provider: provider,
      p_idempotency_key: idempotencyKey,
    });
  },

  getOrder(orderId) {
    return callRpc("get_founders_card_order", { p_order_id: orderId });
  },

  transferCard(cardId, recipientUsername) {
    return callRpc("transfer_founders_card", {
      p_card_id: cardId,
      p_recipient_username: recipientUsername,
    });
  },
};
