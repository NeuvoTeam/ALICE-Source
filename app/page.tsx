"use client";

import { useEffect } from "react";

export default function Page() {
  useEffect(() => {
    const token =
      localStorage.getItem("alice_token");

    if (!token) {
      window.location.href = "/login";
      return;
    }

    window.location.href = "/dashboard";
  }, []);

  return <div>Loading...</div>;
}