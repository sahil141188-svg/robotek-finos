import { requireAuth } from "@/lib/auth";
import { PriceListClient } from "./price-list-client";

export const metadata = { title: "Price List — Robotek FinOS" };

export default async function PriceListPage() {
  const { profile } = await requireAuth();
  return <PriceListClient priceTier={profile.price_tier ?? null} />;
}
