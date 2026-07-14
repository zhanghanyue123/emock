import { PLAN_DEFINITIONS, formatPlanPrice } from "@/lib/plans";
import { Button } from "@/components/ui/Button";

export default function PaidServicePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-xs font-medium uppercase text-muted">Legal</p>
      <h1 className="mt-2 text-3xl font-semibold">付费服务说明</h1>
      <div className="mt-6 grid gap-3">
        {PLAN_DEFINITIONS.filter((plan) => !plan.hidden).map((plan) => (
          <div key={plan.id} className="rounded-lg border border-line bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="font-semibold">{plan.name} · {formatPlanPrice(plan)}</div>
            <p className="mt-2 text-muted">{plan.description}</p>
            <p className="mt-2 text-muted">有效期：{plan.durationDays ? `${plan.durationDays} 天` : plan.billingType === "free" ? "免费试用" : "以页面显示为准"}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-sm leading-7 text-muted">购买成功后，系统会根据支付宝回调或主动查询自动开通权限。支付成功但回调暂时丢失时，可在支付成功页或账单页点击查询同步状态。</p>
      <div className="mt-6"><Button href="/account#plans" variant="primary">View plans</Button></div>
    </main>
  );
}
