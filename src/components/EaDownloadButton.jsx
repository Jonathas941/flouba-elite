import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Download, Loader2 } from "lucide-react";

/**
 * Triggers a direct download of the ready-to-use EA file + a pre-configured
 * .set preset (wired to the user's Robot_Id / bridge credentials), bypassing
 * the email integration entirely.
 */
export default function EaDownloadButton({ robotId = "", className = "" }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("getEaDownload", { robot_id: robotId || undefined });
      const data = res?.data;
      if (!data?.ok) throw new Error(data?.error || res?.error || "Failed to generate EA download.");

      // 1. EA file — open the hosted download URL in a new tab.
      if (data.ea_url) {
        window.open(data.ea_url, "_blank", "noopener,noreferrer");
      }

      // 2. Preset .set — build a Blob and trigger a local download.
      if (data.set_content) {
        const blob = new Blob([data.set_content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.set_filename || "FloubaElite_EA.set";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      toast({
        title: "EA & Preset downloaded",
        description: data.robot_id
          ? `Preset configured for account ${data.robot_id}. Install both on your MT5 terminal.`
          : "Save the EA and .set preset, then install them on your MT5 terminal.",
      });
    } catch (err) {
      toast({ title: "Download failed", description: err?.message || "Could not generate EA files.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" className={className} onClick={handleDownload} disabled={loading}>
      {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Preparing…</> : <><Download className="w-4 h-4 mr-2" />Download EA &amp; Preset</>}
    </Button>
  );
}