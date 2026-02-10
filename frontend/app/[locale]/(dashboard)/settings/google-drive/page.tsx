"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function GoogleDriveSettingsPage() {
  const t = useTranslations("settings");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("googleDrivePage.title")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("googleDrivePage.description")}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Construction className="h-5 w-5" />
            Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Google Drive integration is being redesigned with a simpler OAuth2-based connection flow.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
