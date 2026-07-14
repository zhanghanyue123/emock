import { Button } from "@/components/ui/Button";

export default function AccountDeletionPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-xs font-medium uppercase text-muted">Legal</p>
      <h1 className="mt-2 text-3xl font-semibold">账号注销与数据删除</h1>
      <div className="mt-6 space-y-4 text-sm leading-7 text-muted">
        <p>登录后可在账号页删除云端学习数据，包括练习记录、错题、生词本、设置和同步快照。</p>
        <p>账号注销会删除账号和登录会话，并匿名化订单与退款记录。为满足支付对账，匿名订单记录不会立即删除。</p>
        <p>删除本机浏览器数据可在注销时一起完成，或在浏览器设置中清理本站数据。</p>
      </div>
      <div className="mt-6"><Button href="/account">Open account settings</Button></div>
    </main>
  );
}
