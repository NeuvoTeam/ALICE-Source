"use client";

import { useEffect, useMemo, useState } from "react";

type Client = {
  id: string;
  name: string;
};

const API_BASE =
  "https://clinical-ai-backend.neuvoteam.workers.dev";

  export default function ClientLanding({
    onSelectClient,
  }: {
    onSelectClient: (
      client: any,
      options?: any
    ) => void | Promise<void>;
  }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [clickedId, setClickedId] = useState<string | null>(null);

  const [search, setSearch] = useState("");

  const [firstName, setFirstName] = useState("");
const [middleName, setMiddleName] = useState("");
const [lastName, setLastName] = useState("");

const [email, setEmail] = useState("");

const [countryCode, setCountryCode] =
  useState("+65");

const [phoneNumber, setPhoneNumber] =
  useState("");

  const [creating, setCreating] = useState(false);

const [showAddClient, setShowAddClient] =
  useState(false);

  const fetchClients = async () => {
    try {
      setLoading(true);

      const res = await fetch(
        `${API_BASE}/clients`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      if (!res.ok) {
        throw new Error(
          `Failed to load clients (${res.status})`
        );
      }

      const data = await res.json();

      const parsed = Array.isArray(data)
        ? data
        : [];

      setClients(parsed);
    } catch (err) {
      console.error(err);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClient = async (id: string) => {
    try {
      const res = await fetch(
        `${API_BASE}/client/${id}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      if (!res.ok) {
        throw new Error(
          `Failed to load client (${res.status})`
        );
      }

      return await res.json();
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const handleClientClick = async (
    client: Client
  ) => {
    setClickedId(client.id);

    const fullClient = await fetchClient(
      client.id
    );

    onSelectClient(fullClient || client);
  };

  const handleCreateClient = async () => {
    if (!firstName.trim()) {
      alert("First name is required");
      return;
    }
    
    if (!lastName.trim()) {
      const emailRegex =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (!emailRegex.test(email)) {
  alert("Please enter a valid email");
  return;
}
      alert("Last name is required");
      return;
    }
    
    if (!email.trim()) {
      alert("Email is required");
      return;
    }

    try {
      setCreating(true);

      const res = await fetch(
        `${API_BASE}/clients`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            first_name: firstName,
            middle_name: middleName,
            last_name: lastName,
            email,
            country_code: countryCode,
            phone_number: phoneNumber,
          }),
        }
      );

      if (!res.ok) {
        throw new Error(
          `Failed to create client (${res.status})`
        );
      }

      setFirstName("");
setMiddleName("");
setLastName("");

setEmail("");

setCountryCode("+65");
setPhoneNumber("");

      await fetchClients();

setShowAddClient(false);
    } catch (err) {
      console.error(err);
      alert("Failed to create client");
    } finally {
      setCreating(false);
    }
  };

  const filteredClients = useMemo(() => {
    return clients.filter((client) =>
      client.name
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [clients, search]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        paddingTop: 40,
background:
  "linear-gradient(to bottom, #f8fafc, #eef6ff)",
      }}
    >
      <div
        style={{
          width: 720,
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 32,
          boxShadow:
  "0 10px 30px rgba(15,23,42,0.08)",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          <h1
  style={{
    margin: 0,
    fontSize: 42,
    fontWeight: 800,
    letterSpacing: "-0.04em",
    color: "#0f172a",
  }}
>
  ALICE
</h1>
  
          
        </div>
  
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <input
            placeholder="Search clients..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            style={{
              flex: 1,
              padding: 14,
borderRadius: 12,
fontSize: 15,
              border: "1px solid #d1d5db",
            }}
          />
  
          <button
            onClick={fetchClients}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "none",
              background: "#06b6d4",
              color: "white",
              cursor: "pointer",
            }}
          >
            ↻
          </button>
  
          <button
            onClick={() =>
              setShowAddClient(
                !showAddClient
              )
            }
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "none",
              background: "#06b6d4",
              color: "white",
              cursor: "pointer",
            }}
          >
            + NEW
          </button>
        </div>
  
        {showAddClient && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,0.35)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 999,
    }}
  >
    <div
      style={{
        width: 420,
        background: "#fff",
        borderRadius: 20,
        padding: 24,
        boxShadow:
          "0 20px 50px rgba(0,0,0,0.15)",
      }}
    >
      <h3
        style={{
          marginTop: 0,
          marginBottom: 16,
          fontSize: 22,
        }}
      >
        New Client
      </h3>
      <div
  style={{
    height: 1,
    background: "#e5e7eb",
    marginBottom: 18,
  }}
/>
<div
  style={{
    display: "grid",
    gap: 12,
  }}
>
  <input
    placeholder="First Name"
    value={firstName}
    onChange={(e) =>
      setFirstName(e.target.value)
    }
    style={{
      padding: 12,
      borderRadius: 10,
      border: "1px solid #d1d5db",
    }}
  />

  <input
    placeholder="Middle Name"
    value={middleName}
    onChange={(e) =>
      setMiddleName(e.target.value)
    }
    style={{
      padding: 12,
      borderRadius: 10,
      border: "1px solid #d1d5db",
    }}
  />

  <input
    placeholder="Last Name"
    value={lastName}
    onChange={(e) =>
      setLastName(e.target.value)
    }
    style={{
      padding: 12,
      borderRadius: 10,
      border: "1px solid #d1d5db",
    }}
  />

  <input
    placeholder="Email"
    type="email"
    value={email}
    onChange={(e) =>
      setEmail(e.target.value)
    }
    style={{
      padding: 12,
      borderRadius: 10,
      border: "1px solid #d1d5db",
    }}
  />

  <div
    style={{
      display: "flex",
      gap: 10,
    }}
  >
    <select
      value={countryCode}
      onChange={(e) =>
        setCountryCode(e.target.value)
      }
      style={{
        width: 110,
        padding: 12,
        borderRadius: 10,
        border: "1px solid #d1d5db",
      }}
    >
      <option value="+65">
        🇸🇬 +65
      </option>

      <option value="+61">
        🇦🇺 +61
      </option>

      <option value="+44">
        🇬🇧 +44
      </option>

      <option value="+1">
        🇺🇸 +1
      </option>
    </select>

    <input
      placeholder="Phone Number"
      value={phoneNumber}
      onChange={(e) =>
        setPhoneNumber(
          e.target.value
        )
      }
      style={{
        flex: 1,
        padding: 12,
        borderRadius: 10,
        border: "1px solid #d1d5db",
      }}
    />
  </div>
</div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
          marginTop: 20,
        }}
      >
        <button
          onClick={() =>
            setShowAddClient(false)
          }
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            border: "1px solid #d1d5db",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>

        <button
          onClick={handleCreateClient}
          disabled={creating}
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            border: "none",
            background: "#06b6d4",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          {creating
            ? "Creating..."
            : "Create Client"}
        </button>
      </div>
    </div>
  </div>
)}
        {loading ? (
          <p>Loading...</p>
        ) : filteredClients.length === 0 ? (
          <div>No clients available</div>
        ) : (
          <div>
            {filteredClients.map(
              (client) => (
                <div
                  key={client.id}
                  onClick={() =>
                    handleClientClick(
                      client
                    )
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 16,
                    marginBottom: 10,
                  
                    border:
                      clickedId === client.id
                        ? "1px solid #60a5fa"
                        : "1px solid #e5e7eb",
                  
                    borderRadius: 16,
                    cursor: "pointer",
                  
                    background:
                      clickedId === client.id
                        ? "#eff6ff"
                        : "white",
                  
                    transition:
                      "all 0.2s ease",
                  
                    boxShadow:
                      "0 1px 2px rgba(0,0,0,0.04)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems:
                        "center",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 48,
height: 48,
borderRadius: "50%",
background: "#e0f2fe",

                        display: "flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "center",
                        fontWeight: 700,
                      }}
                    >
                      {client.name
                        .split(" ")
                        .map(
                          (part) =>
                            part[0]
                        )
                        .slice(0, 2)
                        .join("")}
                    </div>
  
                    <div>
                      <div
                        style={{
                          fontWeight:
                            600,
                        }}
                      >
                        {client.name}
                      </div>
  
                      <div
                        style={{
                          fontSize: 12,
                          color:
                            "#64748b",
                        }}
                      >
                        Active Client 
                      </div>
                    </div>
                  </div>
  
                  <div
                    style={{
                      fontSize: 20,
                      color:
                        "#94a3b8",
                    }}
                  >
                    ›
                  </div>
                </div>
              )
            )}
          </div>
        )}
            </div>
    </div>
  );
}