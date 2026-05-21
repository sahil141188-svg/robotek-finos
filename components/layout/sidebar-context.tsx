"use client";

/**
 * SidebarContext — shared state for mobile sidebar open/close.
 * Provided by DashboardShell and consumed by Sidebar + Header.
 */

import { createContext, useContext, useState, type ReactNode } from "react";

type SidebarContextType = {
  isOpen: boolean;
  open:   () => void;
  close:  () => void;
};

const SidebarContext = createContext<SidebarContextType>({
  isOpen: false,
  open:   () => {},
  close:  () => {},
});

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <SidebarContext.Provider value={{ isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) }}>
      {children}
    </SidebarContext.Provider>
  );
}

export const useSidebar = () => useContext(SidebarContext);
