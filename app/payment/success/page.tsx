import { PaymentSuccessClient } from "./PaymentSuccessClient";

export default async function PaymentSuccessPage({ searchParams }: { searchParams: Promise<{ orderId?: string }> }) {
  const params = await searchParams;
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <PaymentSuccessClient orderId={params.orderId} />
    </main>
  );
}
