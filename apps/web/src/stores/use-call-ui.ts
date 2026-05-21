import { create } from "zustand";

type PanelId = "transcript" | "insights" | "signals" | "kb" | "chat" | "wrap-up";

interface CallUIState {
  activePanel: PanelId | null;
  setActivePanel: (panel: PanelId) => void;
  isSidebarExpanded: boolean;
  toggleSidebar: () => void;
}

export const useCallUI = create<CallUIState>((set) => ({
  activePanel: "transcript",
  setActivePanel: (panel) => set({ activePanel: panel }),
  isSidebarExpanded: true,
  toggleSidebar: () => set((s) => ({ isSidebarExpanded: !s.isSidebarExpanded })),
}));
