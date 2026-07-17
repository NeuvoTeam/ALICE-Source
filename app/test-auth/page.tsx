"use client";

import { useEffect } from "react";
import {
  getCurrentUser,
} from "@/lib/auth";

export default function TestAuth() {
  useEffect(() => {
    async function test() {
      const data =
        await getCurrentUser();

      console.log(data);
    }

    test();
  }, []);

  return (
    <div>
      Check console
    </div>
  );
}