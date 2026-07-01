"use client";

import { useEffect, useState } from "react";

type Client = {
  id: string;
  name: string;
};

export default function ClientLanding({
  onSelectClient,
}: {
  onSelectClient: (client: Client) => void;
}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await fetch(
          "https://clinical-ai-backend.neuvoteam.workers.dev/clients",
          {
            method: "GET",
          }
        );

        // ✅ Robust error handling (important for debugging worker issues)
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text}`);
        }

        const data = await res.json();

        console.log("Clients API response:", data);

        // ✅ Handles both:
        // 1) direct array
        // 2) { data: [...] }
        const parsed =
          Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];

        setClients(parsed);
      } catch (err) {
        console.error("Failed to fetch clients:", err);
        setClients([]);
      } finally {
        setLoading(false);
      }
    };

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
          {clients.length === 0 ? (
            <div style={{ color: "#666" }}>
              No clients available
            </div>
          ) : (
            clients.map((client) => (
              <div
                key={client.id}
                onClick={() => onSelectClient(client)}
                style={{
                  padding: 15,
                  border: "1px solid #ddd",
                  marginBottom: 10,
                  cursor: "pointer",
                  borderRadius: 6,
                  transition: "background 0.2s ease",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#f9f9f9")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <strong>{client.name}</strong>
                <div style={{ fontSize: 12, color: "#666" }}>
                  {client.id}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}