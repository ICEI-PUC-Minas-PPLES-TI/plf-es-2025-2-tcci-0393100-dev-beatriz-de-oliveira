import { createBrowserRouter } from "react-router";

export const router = createBrowserRouter([
  {
    path: "/login",
    lazy: () => import("./route-modules/login.route"),
  },
  {
    path: "/",
    lazy: () => import("./route-modules/app-layout.route"),
    children: [
      {
        index: true,
        lazy: () => import("./route-modules/dashboard.route"),
      },
      {
        path: "produtos",
        lazy: () => import("./route-modules/produtos.route"),
      },
      {
        path: "produtos/novo",
        lazy: () => import("./route-modules/produto-form.route"),
      },
      {
        path: "produtos/:id",
        lazy: () => import("./route-modules/produto-form.route"),
      },
      {
        path: "promocoes",
        lazy: () => import("./route-modules/promocoes.route"),
      },
      {
        path: "leads",
        lazy: () => import("./route-modules/leads.route"),
      },
      {
        path: "metricas",
        lazy: () => import("./route-modules/metricas.route"),
      },
      {
        path: "cobrancas",
        lazy: () => import("./route-modules/cobrancas.route"),
      },
      {
        path: "conversas",
        lazy: () => import("./route-modules/conversas.route"),
      },
    ],
  },
  {
    path: "*",
    lazy: () => import("./route-modules/not-found.route"),
  },
]);
