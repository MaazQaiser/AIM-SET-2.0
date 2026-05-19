import { create } from "zustand";

type PanelId = "transcript" | "kb" | "chat";

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
