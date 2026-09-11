import type { Metadata } from "next";

import { SettingsPageContent } from "@/features/auth/identity-controls";

export const metadata: Metadata = {
  title: "Settings | Who's That Pokemon?",
};

const SettingsPage = () => <SettingsPageContent />;

export default SettingsPage;