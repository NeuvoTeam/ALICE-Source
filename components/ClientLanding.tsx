"use client";

import { useEffect, useState } from "react";

type Client = {
  id: string;
  name: string;
};

const API_BASE = "http://127.0.0.1:8787";

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
        const res = await fetch("http://127.0.0.1:8787/clients");
        const data = await res.json();
  
        setClients(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("❌ Failed to fetch clients:", err);
        setClients([]);
      } finally {
        setLoading(false);
      }
    };
  
    fetchClients();
  }, []);
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
                }}
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
