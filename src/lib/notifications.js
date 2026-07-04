import { base44 } from "@/api/base44Client";

/**
 * Lightweight notification logger — fire-and-forget. Never blocks UI flow.
 */
export async function logNotification({ type = "system", title, message, category = "info", meta = {} }) {
  try {
    await base44.entities.Notification.create({ type, title, message, category, read: false, meta });
  } catch {
    // Silent — notifications must never break the primary action.
  }
}