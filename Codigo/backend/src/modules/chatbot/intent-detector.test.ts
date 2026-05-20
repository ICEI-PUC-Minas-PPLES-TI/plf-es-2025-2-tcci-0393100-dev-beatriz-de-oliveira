import { describe, expect, it } from "vitest";
import { detectIntent } from "./intent-detector.js";
import { state } from "../../test/factories.js";

describe("intent-detector", () => {
  it.each([
    ["quero ver tv", "products"],
    ["tem televisao?", "products"],
    ["promocoes de hoje", "promotions"],
    ["preciso de suporte", "unknown"],
    ["falar com vendedor", "human_handoff"],
    ["texto sem sentido 123", "unknown"],
  ] as const)("detecta %s como %s", (text, intent) => {
    expect(detectIntent(text, state())).toBe(intent);
  });

  it("mantem pergunta de preco no fluxo de promocoes recentes", () => {
    expect(detectIntent("qual o preco do copo", state({ recentPromotions: ["COPO TERMICO"] }))).toBe("promotions");
  });

  it("encaminha decisao afirmativa de handoff", () => {
    expect(detectIntent("sim", state({ awaitingHumanHandoffDecision: true }))).toBe("human_handoff");
  });
});
