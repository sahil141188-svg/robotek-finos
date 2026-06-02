import { MessageCircle } from "lucide-react";

/**
 * Click-to-WhatsApp button. Opens wa.me / WhatsApp web with a pre-filled
 * message in a new tab. Presentational only (the href is built server-side
 * from lib/sales/whatsapp-templates).
 */
export function WhatsAppButton({
  href,
  label = "WhatsApp",
  iconOnly = false,
  size = "md",
}: {
  href: string;
  label?: string;
  iconOnly?: boolean;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-4 text-sm";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      aria-label={label}
      className={`inline-flex items-center gap-1.5 rounded-lg font-medium text-white bg-[#25D366] hover:bg-[#1DA851] transition-colors ${iconOnly ? (size === "sm" ? "h-7 w-7 justify-center" : "h-9 w-9 justify-center") : pad}`}
    >
      <MessageCircle className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} />
      {!iconOnly && label}
    </a>
  );
}
