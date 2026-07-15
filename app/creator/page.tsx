"use client";

import { useState } from "react";
import Creator from "./Creator";
import Login from "./Login";

export default function Page() {
  const [loggedIn, setLoggedIn] = useState(false);

  // no database locally — skip login in development only
  const isDev = process.env.NODE_ENV === "development";

  if (!loggedIn && !isDev) {
    return <Login onSuccess={() => setLoggedIn(true)} />;
  }

  return <Creator />;
}
