import { CheckoutClient } from "./CheckoutClient";

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ orderId?: string }> }) {
  const { orderId } = await searchParams;
  return <main className="mx-auto max-w-3xl px-4 py-8"><CheckoutClient orderId={orderId} /></main>;
}
