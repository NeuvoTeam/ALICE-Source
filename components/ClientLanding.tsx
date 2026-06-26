"use client";

import { useEffect, useState } from "react";
import { CLINICAL_AI_API_BASE as API_BASE } from "@/lib/clinical-ai-api";
import { Client } from "@/types";

export default function ClientLanding({
  onSelectClient,
}: {
  onSelectClient: (client: Client) => void;
}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchClients() {
      try {
        const res = await fetch(`${API_BASE}/clients`);
        const data = await res.json();
        setClients(data);
      } catch (err) {
        console.error("Fetch failed:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchClients();
  }, []);

  return (
    <div style={{ padding: 40 }}>
      <h1>ALICE MindCare</h1>
      <p>Select a client</p>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div>
          {clients.map((client) => (
            <div
              key={client.id}
              onClick={() => onSelectClient(client)}
              style={{
                padding: 15,
                border: "1px solid #ddd",
                marginBottom: 10,
                cursor: "pointer",
              }}
            >
              <strong>{client.name}</strong>
              <div style={{ fontSize: 12, color: "#666" }}>
                {client.id}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
``