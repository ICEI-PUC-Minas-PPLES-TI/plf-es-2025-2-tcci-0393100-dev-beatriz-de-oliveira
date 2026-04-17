import type { ChatbotContext, ChatbotResponse, IntentHandler } from "../types.js";

const greetingMessages = [
  [
    "Olá! 👋",
    "Eu sou a assistente virtual da Eletro Rádio Esperança.",
    "",
    "Estou aqui para te ajudar com produtos, promoções ou te encaminhar para um vendedor, se precisar 😊",
    "",
    "Como posso te ajudar?",
  ].join("\n"),
  [
    "Oi! Tudo bem? 😊",
    "Você está falando com a assistente virtual da Eletro Rádio Esperança.",
    "",
    "Posso te mostrar produtos, promoções ou te ajudar a falar com um vendedor.",
    "",
    "O que você gostaria de ver?",
  ].join("\n"),
  [
    "Olá! 👋",
    "Sou a assistente virtual da Eletro Rádio Esperança.",
    "",
    "Posso te ajudar a encontrar produtos, ver promoções ou te direcionar para um vendedor.",
    "",
    "Me diga o que você procura 😊",
  ].join("\n"),
  [
    "Olá! 👋",
    "Sou a assistente virtual da Eletro Rádio Esperança.",
    "",
    "Posso te ajudar com produtos, promoções ou atendimento com vendedor.",
    "",
    "Como posso te ajudar?",
  ].join("\n"),
] as const;

export class GreetingHandler implements IntentHandler {
  intent = "greeting" as const;

  async handle(_context: ChatbotContext): Promise<ChatbotResponse> {
    const opening = greetingMessages[Math.floor(Math.random() * greetingMessages.length)] ?? greetingMessages[0];

    return {
      intent: this.intent,
      handler: "GreetingHandler",
      replyText: opening,
      actions: ["show_menu"],
      handoffRequested: false,
      stateTransition: {
        stage: "MENU_PRINCIPAL",
        awaitingHumanHandoffDecision: false,
        lastShownProducts: [],
      },
    };
  }
}
