"use client";

import { useState } from "react";
import Creator from "./Creator";
import Login from "./Login";

export default function Page() {
  const [loggedIn, setLoggedIn] = useState(false);

  if (!loggedIn) {
    return <Login onSuccess={() => setLoggedIn(true)} />;
  }

  return <Creator />;
}
