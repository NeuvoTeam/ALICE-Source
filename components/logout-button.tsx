"use client";

import { LogOut } from "lucide-react";
import { logout } from "@/lib/auth";

export default function LogoutButton() {
  return (
    <button
      onClick={logout}
      className="
  flex
  w-full
  items-center
  justify-center
  gap-2
  rounded-lg
  border
  border-gray-200
  bg-gray-50
  px-3
  py-2
  text-sm
  font-medium
  text-gray-700
  transition
  hover:bg-gray-100
"
    >
      <LogOut className="h-4 w-4" />
      Logout
    </button>
  );
}