"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  RotateCw,
  User,
  Users,
  ChevronRight,
  Mail,
  Phone,
  AlertCircle,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { CLINICAL_AI_API_BASE } from "@/lib/clinical-ai-api";
import { apiFetch } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Client = {
  id: string;
  name: string;
};

const COUNTRY_CODES = [
  { code: "+65", label: "🇸🇬 +65 (Singapore)" },
  { code: "+61", label: "🇦🇺 +61 (Australia)" },
  { code: "+1", label: "🇺🇸 +1 (US / Canada)" },
  { code: "+44", label: "🇬🇧 +44 (UK)" },
  { code: "+852", label: "🇭🇰 +852 (Hong Kong)" },
  { code: "+886", label: "🇹🇼 +886 (Taiwan)" },
  { code: "+60", label: "🇲🇾 +60 (Malaysia)" },
  { code: "+62", label: "🇮🇩 +62 (Indonesia)" },
  { code: "+66", label: "🇹🇭 +66 (Thailand)" },
  { code: "+84", label: "🇻🇳 +84 (Vietnam)" },
  { code: "+63", label: "🇵🇭 +63 (Philippines)" },
  { code: "+91", label: "🇮🇳 +91 (India)" },
  { code: "+81", label: "🇯🇵 +81 (Japan)" },
  { code: "+82", label: "🇰🇷 +82 (South Korea)" },
  { code: "+86", label: "🇨🇳 +86 (China)" },
];

export default function ClientLanding({
  onSelectClient,
}: {
  onSelectClient: (
    client: Client,
    options?: { bootstrap?: boolean }
  ) => void | Promise<void>;
}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [clickedId, setClickedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // New Client Form
  const [showAddClient, setShowAddClient] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+65");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const isFormValid =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    emailRegex.test(email) &&
    /^\d+$/.test(phoneNumber) &&
    phoneNumber.length >= 6 &&
    phoneNumber.length <= 15;

  const fetchClients = useCallback(async () => {
    try {
      const res = await apiFetch(`${CLINICAL_AI_API_BASE}/clients`, {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Failed to load clients (${res.status})`);
      }

      const data = await res.json();
      const parsed = Array.isArray(data) ? data : [];
      setClients(parsed);
    } catch (err) {
      console.error("Failed to load clients:", err);
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await fetchClients();
    })();
  }, [fetchClients]);

  const fetchClient = async (id: string) => {
    try {
      const res = await apiFetch(`${CLINICAL_AI_API_BASE}/client/${id}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Failed to load client (${res.status})`);
      }

      return await res.json();
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const handleClientClick = async (client: Client) => {
    setClickedId(client.id);
    const fullClient = await fetchClient(client.id);
    onSelectClient(fullClient || client);
  };

  const handleCreateClient = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError(null);

    if (!firstName.trim()) {
      setFormError("First name is required.");
      return;
    }

    if (!lastName.trim()) {
      setFormError("Last name is required.");
      return;
    }

    if (!email.trim() || !emailRegex.test(email)) {
      setFormError("Please enter a valid email address.");
      return;
    }

    if (!phoneNumber.trim() || !/^\d+$/.test(phoneNumber)) {
      setFormError("Phone number can only contain numbers.");
      return;
    }

    if (phoneNumber.length < 6 || phoneNumber.length > 15) {
      setFormError("Phone number must be between 6 and 15 digits.");
      return;
    }

    try {
      setCreating(true);

      const res = await apiFetch(`${CLINICAL_AI_API_BASE}/clients`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: firstName.trim(),
          middle_name: middleName.trim() || undefined,
          last_name: lastName.trim(),
          email: email.trim(),
          country_code: countryCode,
          phone_number: phoneNumber.trim(),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || `Failed to create client (${res.status})`);
      }

      // Reset form
      setFirstName("");
      setMiddleName("");
      setLastName("");
      setEmail("");
      setCountryCode("+65");
      setPhoneNumber("");
      setShowAddClient(false);

      setLoading(true);
      await fetchClients();
    } catch (err) {
      console.error(err);
      setFormError(err instanceof Error ? err.message : "Failed to register new client.");
    } finally {
      setCreating(false);
    }
  };

  const filteredClients = useMemo(() => {
    return clients.filter((client) =>
      client.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [clients, search]);

  const initials = (name: string) =>
    name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "CL";

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">

        {/* WORKSPACE HEADER */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Clients &amp; Caseload
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Select a client to open their clinical formulation workspace or register a new patient.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLoading(true);
                void fetchClients();
              }}
              disabled={loading}
              className="h-10 text-xs font-medium"
            >
              <RotateCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>

            <Button
              onClick={() => {
                setFormError(null);
                setShowAddClient(true);
              }}
              className="h-10 text-xs font-semibold shadow-sm"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              New Client
            </Button>
          </div>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search clients by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pl-10 pr-9 bg-background shadow-xs text-sm"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>
              {filteredClients.length} of {clients.length} Clients
            </span>
          </div>
        </div>

        {/* CASELOAD LIST / GRID */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Loading patient directory…</p>
          </div>
        ) : filteredClients.length === 0 ? (
          <Card className="border-dashed bg-background/50">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <User className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                {search ? `No clients found for "${search}"` : "No clients in caseload yet"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-6">
                {search
                  ? "Check spelling or clear search filter to see all registered patients."
                  : "Register your first client to start creating sessions, formulation notes, and homework activities."}
              </p>
              {search ? (
                <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                  Clear search
                </Button>
              ) : (
                <Button onClick={() => setShowAddClient(true)} size="sm">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add First Client
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredClients.map((client) => {
              const isSelected = clickedId === client.id;
              return (
                <Card
                  key={client.id}
                  onClick={() => handleClientClick(client)}
                  className={`group relative overflow-hidden transition-all duration-150 cursor-pointer hover:border-foreground/30 hover:shadow-md ${
                    isSelected ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "bg-card"
                  }`}
                >
                  <CardContent className="p-5 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-bold text-slate-700 text-sm border border-slate-200/80 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                        {initials(client.name)}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                          {client.name}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                          <span>Active Caseload</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground group-hover:bg-muted group-hover:text-foreground transition-colors">
                      {isSelected ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

      </div>

      {/* NEW CLIENT DIALOG */}
      <Dialog open={showAddClient} onOpenChange={setShowAddClient}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Register New Client</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Add client details to establish a case file and enable practice assignments.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateClient} className="space-y-4 py-2">
            {formError && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs font-medium text-destructive"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-first-name" className="text-xs font-semibold">
                  First Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="new-first-name"
                  placeholder="Jane"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={creating}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-last-name" className="text-xs font-semibold">
                  Last Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="new-last-name"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={creating}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-middle-name" className="text-xs font-semibold">
                Middle Name <span className="text-muted-foreground font-normal">(Optional)</span>
              </Label>
              <Input
                id="new-middle-name"
                placeholder="Elizabeth"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                disabled={creating}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-email" className="text-xs font-semibold">
                Email Address <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="new-email"
                  type="email"
                  placeholder="client@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={creating}
                  required
                  className="pl-9"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">Used for delivering practice assignments.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-phone" className="text-xs font-semibold">
                Phone Number <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Select
                  value={countryCode}
                  onValueChange={setCountryCode}
                  disabled={creating}
                >
                  <SelectTrigger className="w-[125px] shrink-0 text-xs">
                    <SelectValue placeholder="Code" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {COUNTRY_CODES.map((item) => (
                      <SelectItem key={item.code} value={item.code} className="text-xs">
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-phone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="91234567"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                    disabled={creating}
                    required
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddClient(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creating || !isFormValid}
                className="font-semibold shadow-sm"
              >
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registering…
                  </>
                ) : (
                  "Create Client Profile"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}