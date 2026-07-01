import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CeoPanel } from "@/components/dashboard/ceo-panel";

export const Route = createFileRoute("/_authenticated/")({
  component: () => (
    <AppShell>
      <CeoPanel />
    </AppShell>
  ),
});