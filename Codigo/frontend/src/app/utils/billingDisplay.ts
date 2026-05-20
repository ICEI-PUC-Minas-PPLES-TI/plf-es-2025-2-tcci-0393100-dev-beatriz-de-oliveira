import type { Pedido } from "../types/domain";

export const formatChargeChannelLabel = (channel?: Pedido["cobrancaCanal"]) => {
  if (channel === "telegram") return "Telegram";
  return "Sem canal disponível";
};
