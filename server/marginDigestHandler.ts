import { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { getMarginAlerts } from "./db";

const DIGEST_RECIPIENTS = [
  "Chuck@poolpartstogo.com",
  "Dan@poolpartstogo.com",
  "Ben@poolpartstogo.com",
];

const FORGE_API_URL = process.env.BUILT_IN_FORGE_API_URL ?? "";
const FORGE_API_KEY = process.env.BUILT_IN_FORGE_API_KEY ?? "";

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const res = await fetch(`${FORGE_API_URL}/api/v1/notification/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${FORGE_API_KEY}`,
      },
      body: JSON.stringify({ to, subject, html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function marginColor(pct: number): string {
  if (pct >= 35) return "#16a34a";
  if (pct >= 25) return "#ca8a04";
  if (pct >= 15) return "#ea580c";
  return "#dc2626";
}

function buildHtml(alerts: Awaited<ReturnType<typeof getMarginAlerts>>, generatedAt: string): string {
  const total = alerts.length;
  const belowFloor = alerts.filter(a => {
    const price = Number(a.price ?? 0);
    const floor = Number(a.floorPrice ?? 0);
    return floor > 0 && price < floor;
  }).length;
  const belowTarget = total - belowFloor;

  // Group by channel
  const byChannel: Record<string, typeof alerts> = {};
  for (const a of alerts) {
    if (!byChannel[a.channelName]) byChannel[a.channelName] = [];
    byChannel[a.channelName].push(a);
  }

  const channelSummaryRows = Object.entries(byChannel)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([ch, rows]) => `
      <tr>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${ch}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${rows.length}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${rows.filter(r => {
          const price = Number(r.price ?? 0);
          const floor = Number(r.floorPrice ?? 0);
          return floor > 0 && price < floor;
        }).length}</td>
      </tr>`)
    .join("");

  const top20 = alerts
    .sort((a, b) => Number(a.marginPct) - Number(b.marginPct))
    .slice(0, 20);

  const alertRows = top20.map(a => {
    const m = Number(a.marginPct ?? 0) * 100;
    const color = marginColor(m);
    const isBelowFloor = Number(a.floorPrice ?? 0) > 0 && Number(a.price ?? 0) < Number(a.floorPrice ?? 0);
    const flag = isBelowFloor
      ? `<span style="color:#dc2626;font-weight:bold;">⚠ Below Floor</span>`
      : `<span style="color:#ea580c;">Below Target</span>`;
    return `
      <tr>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace;font-size:12px;">${a.skuCode}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.description ?? ""}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${a.channelName}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">$${Number(a.price ?? 0).toFixed(2)}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:${color};font-weight:bold;">${m.toFixed(1)}%</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${flag}</td>
      </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Margin Alert Digest</title></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:700px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <!-- Header -->
    <div style="background:#1e293b;padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">📊 Daily Margin Alert Digest</h1>
      <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">poolpartstogo.com · ${generatedAt}</p>
    </div>

    <!-- Summary cards -->
    <div style="display:flex;gap:0;border-bottom:1px solid #e5e7eb;">
      <div style="flex:1;padding:20px 24px;border-right:1px solid #e5e7eb;">
        <div style="font-size:28px;font-weight:800;color:#1e293b;">${total}</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px;">Total Alerts</div>
      </div>
      <div style="flex:1;padding:20px 24px;border-right:1px solid #e5e7eb;">
        <div style="font-size:28px;font-weight:800;color:#dc2626;">${belowFloor}</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px;">Below Floor Price</div>
      </div>
      <div style="flex:1;padding:20px 24px;">
        <div style="font-size:28px;font-weight:800;color:#ea580c;">${belowTarget}</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px;">Below Target Margin</div>
      </div>
    </div>

    <!-- By channel -->
    <div style="padding:24px 32px 0;">
      <h2 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.05em;">Alerts by Channel</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:8px 12px;text-align:left;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Channel</th>
            <th style="padding:8px 12px;text-align:center;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Total</th>
            <th style="padding:8px 12px;text-align:center;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Below Floor</th>
          </tr>
        </thead>
        <tbody>${channelSummaryRows}</tbody>
      </table>
    </div>

    <!-- Top 20 worst -->
    <div style="padding:24px 32px;">
      <h2 style="margin:0 0 12px;font-size:14px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.05em;">Top 20 Lowest Margin SKUs</h2>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="padding:8px 12px;text-align:left;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">SKU</th>
            <th style="padding:8px 12px;text-align:left;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Description</th>
            <th style="padding:8px 12px;text-align:left;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Channel</th>
            <th style="padding:8px 12px;text-align:right;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Price</th>
            <th style="padding:8px 12px;text-align:right;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Margin</th>
            <th style="padding:8px 12px;text-align:left;color:#6b7280;font-weight:600;border-bottom:2px solid #e5e7eb;">Status</th>
          </tr>
        </thead>
        <tbody>${alertRows || `<tr><td colspan="6" style="padding:16px 12px;color:#9ca3af;text-align:center;">No alerts — all margins look good!</td></tr>`}</tbody>
      </table>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">
        View full details at <a href="https://skucostandprice.manus.space/alerts" style="color:#3b82f6;">skucostandprice.manus.space/alerts</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function marginDigestHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only" });
    }

    const alerts = await getMarginAlerts(undefined, 0.25); // default 25% threshold
    const generatedAt = new Date().toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
      timeZone: "America/New_York",
    });

    const subject = `Margin Alert Digest — ${alerts.length} alerts · ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}`;
    const html = buildHtml(alerts, generatedAt);

    const results = await Promise.all(
      DIGEST_RECIPIENTS.map(to => sendEmail(to, subject, html))
    );

    const sent = results.filter(Boolean).length;
    console.log(`[margin-digest] Sent ${sent}/${DIGEST_RECIPIENTS.length} emails, ${alerts.length} alerts`);

    return res.json({ ok: true, alertCount: alerts.length, emailsSent: sent });
  } catch (err) {
    console.error("[margin-digest] Error:", err);
    return res.status(500).json({
      error: String(err),
      timestamp: new Date().toISOString(),
    });
  }
}
