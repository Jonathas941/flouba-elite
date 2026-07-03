import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const MT5_BASE = "https://294108ed-e055-41b7-b93f-e2ddafbe8693-00-1ryk2spld8s3q.riker.replit.dev";

Deno.serve(async (req) => {
  try {
    const bodyText = await req.text().catch(() => "{}");
    let body = {};
    try { body = JSON.parse(bodyText); } catch {}

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const email = body.email || user.email;
    if (!email) return Response.json({ error: "No email address on file" }, { status: 400 });

    // The EA endpoint requires X-Api-Key — try the user's provisioned key first, then server secrets
    const candidateKeys = [
      user.mt5_api_key,
      Deno.env.get("PROVISION_SECRET"),
      Deno.env.get("MT5_API_TOKEN"),
      Deno.env.get("CRON_SECRET"),
    ].filter(Boolean);

    // Try multiple route/method combinations with each key
    const routeAttempts = [
      { path: "/api/bridge/ea", method: "POST" },
      { path: "/api/bridge/ea", method: "GET" },
      { path: "/api/bridge/ea/download", method: "GET" },
      { path: "/api/bridge/ea/file", method: "GET" },
      { path: "/api/bridge/download", method: "GET" },
    ];

    let eaRes = null;
    let lastErr = "";
    outer:
    for (const key of candidateKeys) {
      for (const route of routeAttempts) {
        try {
          eaRes = await fetch(`${MT5_BASE}${route.path}`, {
            method: route.method,
            headers: { "X-Api-Key": key, "Content-Type": "application/json" },
            body: route.method === "POST" ? JSON.stringify({ email }) : undefined,
          });
          if (eaRes.status === 404) { eaRes = null; continue; }
          if (eaRes.status === 401) { eaRes = null; break; } // wrong key, try next key
          break outer; // got a non-401, non-404 response
        } catch (e) {
          lastErr = e.message;
          eaRes = null;
        }
      }
    }

    if (!eaRes) {
      return Response.json({ error: `EA endpoint not reachable. ${lastErr}` }, { status: 502 });
    }

    if (!eaRes.ok) {
      const errText = await eaRes.text().catch(() => "");
      return Response.json({ error: `EA fetch failed: ${errText.slice(0, 200)}` }, { status: 502 });
    }

    const contentType = eaRes.headers.get("content-type") || "";

    // If the server returns JSON, it may contain a download URL or instructions
    if (contentType.includes("application/json")) {
      const eaJson = await eaRes.json().catch(() => ({}));
      const downloadUrl = eaJson?.download_url || eaJson?.url || eaJson?.data?.url;

      if (downloadUrl) {
        await base44.integrations.Core.SendEmail({
          to: email,
          subject: "Flouba Elite — Your EA File",
          body: `Hello ${user.full_name || ""},\n\nYour MT5 account is connected to Flouba Elite.\n\nDownload your Expert Advisor (EA) file here:\n${downloadUrl}\n\nInstallation steps:\n1. Open MT5 → File → Open Data Folder\n2. Go to MQL5/Experts\n3. Copy the EA file into that folder\n4. Restart MT5 → drag the EA onto your chart\n5. Enable AutoTrading\n\n— Flouba Elite Team`,
        });
        return Response.json({ ok: true, sent: true, method: "download_link", email });
      }

      // If JSON but no URL, treat the raw text as the EA file content (some servers return base64)
      return Response.json({ error: "EA endpoint returned JSON without a download URL", detail: JSON.stringify(eaJson).slice(0, 300) }, { status: 500 });
    }

    // Binary file — upload to Base44 storage, then email a signed download link
    const eaBytes = new Uint8Array(await eaRes.arrayBuffer());
    const fileName = "FloubaElite_EA.ex5";

    // Upload to Base44 private storage
    const uploadRes = await base44.integrations.Core.UploadPrivateFile({ file: eaBytes });
    const fileUri = uploadRes?.file_uri;
    if (!fileUri) return Response.json({ error: "Failed to store EA file" }, { status: 500 });

    // Create a time-limited signed URL (7 days)
    const signed = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri, expires_in: 604800 });
    const signedUrl = signed?.signed_url;
    if (!signedUrl) return Response.json({ error: "Failed to create download link" }, { status: 500 });

    await base44.integrations.Core.SendEmail({
      to: email,
      subject: "Flouba Elite — Your EA File",
      body: `Hello ${user.full_name || ""},\n\nYour MT5 account is now connected to Flouba Elite.\n\nDownload your Expert Advisor (EA) file here (link expires in 7 days):\n${signedUrl}\n\nInstallation steps:\n1. Open MT5 → File → Open Data Folder\n2. Go to MQL5/Experts\n3. Copy the EA file into that folder\n4. Restart MT5 → drag the EA onto your chart\n5. Enable AutoTrading (green button in toolbar)\n\nThe EA will automatically connect to the Flouba Elite bridge server.\n\n— Flouba Elite Team`,
    });

    return Response.json({ ok: true, sent: true, method: "attachment_link", email });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});