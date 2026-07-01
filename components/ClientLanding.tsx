"use client";

import { useEffect, useState } from "react";

type Client = {
  id: string;
  name: string;
};

// ✅ FORCE absolute URL
const API_BASE = "https://clinical-ai-backend.neuvoteam.workers.dev";

export default function ClientLanding({
  onSelectClient,
}: {
  onSelectClient: (client: any) => void;
}) {
  console.log("✅ ClientLanding component LOADED");

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [clickedId, setClickedId] = useState<string | null>(null);

  /* =========================
     ✅ FETCH SINGLE CLIENT
  ========================= */
  const fetchClient = async (id: string) => {
    try {
      const url = new URL(`/client/${id}`, API_BASE).toString(); // ✅ FORCE ABSOLUTE

      console.log("🚀 Fetching client:", url);

      const res = await fetch(url);

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const data = await res.json();
      console.log("✅ Client detail:", data);

      return data;
    } catch (err) {
      console.error("❌ Failed to fetch client:", err);
      return null;
    }
  };

  /* =========================
     ✅ FETCH CLIENT LIST
  ========================= */
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const url = new URL("/clients", API_BASE).toString(); // ✅ FORCE ABSOLUTE

        console.log("📡 Fetching clients:", url);

        const res = await fetch(url);

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text}`);
        }

        const data = await res.json();
        console.log("✅ Clients API response:", data);

        const parsed =
          Array.isArray(data)
            ? data
            : Array.isArray(data?.data)
            ? data.data
            : [];

        setClients(parsed);
      } catch (err) {
        console.error("❌ Failed to fetch clients:", err);
        setClients([]);
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, []);

  /* =========================
     ✅ HANDLE CLICK
  ========================= */
  const handleClientClick = async (client: Client) => {
    console.log("👉 CLICKED CLIENT:", client.id);

    setClickedId(client.id);

    const fullClient = await fetchClient(client.id);

    if (fullClient) {
      onSelectClient(fullClient);
    } else {
      onSelectClient(client);
    }
  };

  /* =========================
     ✅ UI
  ========================= */
  return (
    <div style={{ padding: 40 }}>
      <h1>ALICE MindCare</h1>
      <p>Select a client</p>

      {loading ? (
        <p>Loading...</p>
      ) : clients.length === 0 ? (
        <div>No clients available</div>
      ) : (
        <div>
          {clients.map((client) => (
            <div
              key={client.id}
              onClick={() => handleClientClick(client)}
              style={{
                padding: 15,
                marginBottom: 10,
                border:
                  clickedId === client.id
                    ? "2px solid #3b82f6"
                    : "2px solid #ddd",
                borderRadius: 6,
                cursor: "pointer",
                background:
                  clickedId === client.id ? "#eef4ff" : "#fff",
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