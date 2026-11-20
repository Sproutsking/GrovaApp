import { readFileSync } from "fs";
import { resolve } from "path";
import { parseFoundersCardsCsv } from "./foundersCardService";
import { foundersCardService } from "./foundersCardService";
import { supabase } from "./config/supabase";

jest.mock("./config/supabase", () => ({
  supabase: {
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

const tiers = [
  ["Silver", 900, 12],
  ["Gold", 300, 25],
  ["Diamond", 150, 50],
  ["VIP", 50, 100],
];
const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function makeCardCode(value) {
  let number = value;
  const body = Array(9).fill(alphabet[0]);
  for (let index = body.length - 1; index >= 0; index -= 1) {
    body[index] = alphabet[number % alphabet.length];
    number = Math.floor(number / alphabet.length);
  }
  const checksum = body.reduce((sum, character, index) => (
    sum + (index + 1) * alphabet.indexOf(character)
  ), 0);
  const compact = `${body.join("")}${alphabet[checksum % alphabet.length]}`;
  return `${compact.slice(0, 5)}-${compact.slice(5)}`;
}

function makeRegistryCsv() {
  const rows = ["tier,serial,supply,serial_display,card_code,list_price,status,owner_id,issued_at"];
  let code = 1;
  for (const [tier, supply, price] of tiers) {
    for (let serial = 1; serial <= supply; serial += 1) {
      rows.push(`${tier},${serial},${supply},#${String(serial).padStart(6, "0")}/${String(supply).padStart(4, "0")},${makeCardCode(code)},${price},available,,`);
      code += 1;
    }
  }
  return rows.join("\n");
}

describe("parseFoundersCardsCsv", () => {
  it("accepts the complete registry and preserves codes without exposing owner data", () => {
    const cards = parseFoundersCardsCsv(makeRegistryCsv());

    expect(cards).toHaveLength(1400);
    expect(cards[0]).toMatchObject({
      tier: "Silver",
      serial: 1,
      serial_display: "#000001/0900",
      card_code: makeCardCode(1),
      owner_id: null,
      issued_at: null,
    });
    expect(cards.at(-1)).toMatchObject({ tier: "VIP", serial: 50, supply: 50 });
  });

  it("accepts the supplied 1,400-card registry", () => {
    const csv = readFileSync(
      resolve(__dirname, "../../founders_charter_complete/founders_cards.csv"),
      "utf8",
    );

    expect(parseFoundersCardsCsv(csv)).toHaveLength(1400);
  });

  it("rejects an incomplete registry before it can be imported", () => {
    expect(() => parseFoundersCardsCsv("tier,serial\nSilver,1")).toThrow(
      "not the expected founders_cards.csv registry",
    );
  });

  it("rejects duplicate card codes", () => {
    const csv = makeRegistryCsv().replace(
      `Silver,2,900,#000002/0900,${makeCardCode(2)}`,
      `Silver,2,900,#000002/0900,${makeCardCode(1)}`,
    );

    expect(() => parseFoundersCardsCsv(csv)).toThrow("duplicate card code");
  });

  it("rejects a card code with an invalid checksum", () => {
    const csv = makeRegistryCsv().replace(makeCardCode(1), "AAAAA-AAAAB");

    expect(() => parseFoundersCardsCsv(csv)).toThrow("does not match");
  });
});

describe("founders-card catalog updates", () => {
  it("subscribes privately, refreshes after connection, and removes its channel", () => {
    const channel = {
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
    };
    const onUpdate = jest.fn();
    const onStatus = jest.fn();
    supabase.channel.mockReturnValue(channel);
    supabase.removeChannel.mockResolvedValue("ok");

    const unsubscribe = foundersCardService.subscribeToCatalogUpdates(onUpdate, onStatus);
    const statusHandler = channel.subscribe.mock.calls[0][0];
    statusHandler("SUBSCRIBED");
    const broadcastHandler = channel.on.mock.calls[0][2];
    broadcastHandler({ payload: { tier: "Silver" } });

    expect(supabase.channel).toHaveBeenCalledWith(
      "founders-card-catalog",
      { config: { private: true } },
    );
    expect(channel.on).toHaveBeenCalledWith(
      "broadcast",
      { event: "catalog_updated" },
      expect.any(Function),
    );
    expect(onStatus).toHaveBeenCalledWith("SUBSCRIBED");
    expect(onUpdate).toHaveBeenCalledTimes(2);
    unsubscribe();
    expect(supabase.removeChannel).toHaveBeenCalledWith(channel);
  });
});
