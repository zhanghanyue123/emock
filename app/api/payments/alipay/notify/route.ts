import { processAlipayNotification } from "@/lib/server/alipay-provider";

export async function POST(request: Request) {
  const body = await request.text();
  const params = Object.fromEntries(new URLSearchParams(body));
  const result = await processAlipayNotification(params);
  return new Response(result.ok ? "success" : "failure", {
    status: result.ok ? 200 : 400,
    headers: { "content-type": "text/plain; charset=utf-8" }
  });
}
