"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";

/**
 * Legacy shim for the retired "homework" client link.
 *
 * The clinician used to mint two links (`/homework/:id` and `/practice/:id`) for
 * the same session. They are consolidated into one, so a link shared before the
 * change still works: this page forwards it to the interactive practice view.
 */
export default function HomeworkPage() {
  const params = useParams();

  const sessionId =
    typeof params?.sessionId === "string"
      ? params.sessionId
      : Array.isArray(params?.sessionId)
      ? params.sessionId[0]
      : null;

  useEffect(() => {
    if (!sessionId) return;

    // A hard navigation (`window.location.replace`), not `router.replace`, so
    // the signed `?exp=…&sig=…` pair survives verbatim — it is the client
    // page's only credential. `replace` also keeps the dead /homework/… URL out
    // of the browser history.
    window.location.replace(`/practice/${sessionId}${window.location.search}`);
  }, [sessionId]);

  return (
    <div className="min-h-screen flex items-center justify-center text-gray-500">
      {sessionId ? "Opening your session..." : "Missing session ID"}
    </div>
  );
}