"use client";

import { useEffect, useState } from "react";
import { getCurrentUser } from "@/lib/auth";

export default function AuthGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    async function checkAuth() {
      const user =
        await getCurrentUser();

      if (!user) {
        window.location.href =
          "/login";
        return;
      }

      setLoading(false);
    }

    checkAuth();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return <>{children}</>;
}