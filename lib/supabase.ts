/**
 * 🚨 FRONTEND MUST NOT CONNECT TO SUPABASE DIRECTLY
 * ✅ All data access goes through Cloudflare Worker
 * ✅ This file is intentionally blocked
 */

export const supabase = new Proxy(
  {},
  {
    get() {
      throw new Error(
        "❌ Direct Supabase usage in frontend is disabled. Use Cloudflare API instead."
      );
    },
  }
);