"use client";

import { useKbProjects } from "@/lib/data/hooks";

/** Starts expensive dashboard-adjacent queries while the authenticated shell is already open. */
export function DashboardDataWarmup() {
  useKbProjects();
  return null;
}
