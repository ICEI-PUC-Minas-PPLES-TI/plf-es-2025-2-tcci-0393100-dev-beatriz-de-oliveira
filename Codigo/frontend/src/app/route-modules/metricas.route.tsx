import { redirect } from "react-router";
import { authStorage } from "../lib/auth";
import { Metricas as Component } from "../pages/Metricas";

export async function loader() {
  const user = authStorage.getUser();

  if (!user) {
    throw redirect("/login");
  }

  if (user.role === "VENDEDOR") {
    throw redirect("/");
  }

  return null;
}

export { Component };
