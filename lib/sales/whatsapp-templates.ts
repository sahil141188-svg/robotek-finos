/**
 * WhatsApp message templates for the AI Sales Coordinator.
 *
 * Hinglish, Robotek tone — these power both the assisted "click-to-WhatsApp"
 * buttons (wa.me) and, later, automated sends via lib/whatsapp.ts.
 * Keep them short: high open + reply rate, low block risk.
 *
 * Edit the copy freely — Sahil owns the customer relationship. (You can also
 * regenerate brand-tuned variants with the /whatsapp-content skill.)
 */

const SIGN = "— Robotek India 🔋";

/** Build a bullet list of item names. */
function itemLines(items: { name: string }[], max = 6): string {
  return items.slice(0, max).map((i) => `• ${i.name}`).join("\n");
}

/**
 * Churn nudge with the customer's actual regular items.
 * Used from the per-customer page (we know their focus items).
 */
export function churnNudgeWithItems(firm: string, items: { name: string }[]): string {
  const list = items.length ? `\n\nAap ye regular lete hain:\n${itemLines(items)}` : "";
  return (
    `Namaste ${firm} 🙏\n\n` +
    `Robotek se. Aapka order kaafi time se pending hai.${list}\n\n` +
    `Aaj fresh stock ready hai — bhej dein? Latest rate bhi bhej dete hain.\n\n` +
    SIGN
  );
}

/** Generic churn nudge (no specific items) — used on the Churn Radar list. */
export function churnNudge(firm: string): string {
  return (
    `Namaste ${firm} 🙏\n\n` +
    `Aapka Robotek order kaafi din se pending hai. Aaj ka fresh stock ready hai — ` +
    `order bhej dein? Latest rate bhi share kar dete hain.\n\n` +
    SIGN
  );
}

/** New-launch announcement for one product. */
export function newLaunch(firm: string, product: string): string {
  return (
    `Namaste ${firm} 🙏\n\n` +
    `🆕 New launch: *${product}*\n` +
    `Abhi stock available hai. Order ke liye reply karein.\n\n` +
    SIGN
  );
}

/** Back-in-stock alert for one product. */
export function backInStock(firm: string, product: string): string {
  return (
    `Namaste ${firm} 🙏\n\n` +
    `✅ *${product}* wapas stock me aa gaya hai!\n` +
    `Aap ye regular lete hain — bhej dein?\n\n` +
    SIGN
  );
}

/**
 * Build a click-to-WhatsApp URL.
 * - With phone → opens the chat with that dealer, message pre-filled.
 * - Without phone → opens WhatsApp's contact picker with the message pre-filled.
 * `phone` may be any format; we strip to digits and default to +91.
 */
export function waLink(message: string, phone?: string | null): string {
  const text = encodeURIComponent(message);
  if (phone && phone.replace(/\D/g, "").length >= 10) {
    let digits = phone.replace(/\D/g, "");
    if (digits.length === 10) digits = `91${digits}`; // assume India
    return `https://wa.me/${digits}?text=${text}`;
  }
  return `https://api.whatsapp.com/send?text=${text}`;
}
