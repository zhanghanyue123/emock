import { Button } from "@/components/ui/Button";

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-xs font-medium uppercase text-muted">Legal</p>
      <h1 className="mt-2 text-3xl font-semibold">联系方式</h1>
      <div className="mt-6 space-y-4 text-sm leading-7 text-muted">
        <p>支付、退款、账号和数据问题，请在正式上线前配置真实客服邮箱、经营主体名称和服务时间。</p>
        <p>当前开发环境可先通过账号页、账单页和订单号定位问题。</p>
      </div>
      <div className="mt-6"><Button href="/account/billing">View billing</Button></div>
    </main>
  );
}
