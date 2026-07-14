import { Button } from "@/components/ui/Button";

export default function RefundPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-xs font-medium uppercase text-muted">Legal</p>
      <h1 className="mt-2 text-3xl font-semibold">退款规则</h1>
      <div className="mt-6 space-y-4 text-sm leading-7 text-muted">
        <p>未付款订单可在账单页关闭，不会开通权限。</p>
        <p>已付款订单可在账单页申请退款。退款成功后，对应付费权限会撤销并恢复免费权限。</p>
        <p>退款以支付宝实际处理结果为准。系统会保存退款和对账记录，方便排查重复回调、状态延迟或主动查询差异。</p>
        <p>如遇支付成功但权限未开通，请先在支付成功页或账单页点击查询订单；仍未恢复时可通过联系方式提交订单号。</p>
      </div>
      <div className="mt-6"><Button href="/account/billing">Billing</Button></div>
    </main>
  );
}
