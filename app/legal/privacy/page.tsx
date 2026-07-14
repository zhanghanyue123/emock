import { Button } from "@/components/ui/Button";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-xs font-medium uppercase text-muted">Legal</p>
      <h1 className="mt-2 text-3xl font-semibold">隐私政策</h1>
      <div className="mt-6 space-y-4 text-sm leading-7 text-muted">
        <p>我们会保存账号邮箱、套餐状态、订单记录、支付回调记录、练习记录、作文、录音元数据、错题、生词本和设置，用于登录、开通权限、复盘和跨设备同步。</p>
        <p>支付由支付宝处理。本站保存订单号、支付状态、交易号、退款和对账信息，不保存银行卡或支付宝密码。</p>
        <p>你可以在账号页删除云端学习数据，或申请注销账号。注销后，账号资料会删除，订单和退款记录会做匿名化留存以满足对账需要。</p>
        <p>正式上线前应配置 HTTPS、生产数据库、备份和访问控制，并补充经营主体、联系方式和数据保护负责人信息。</p>
      </div>
      <div className="mt-6"><Button href="/account">Data controls</Button></div>
    </main>
  );
}
