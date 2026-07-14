import { Button } from "@/components/ui/Button";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="text-xs font-medium uppercase text-muted">Legal</p>
      <h1 className="mt-2 text-3xl font-semibold">用户协议</h1>
      <div className="mt-6 space-y-4 text-sm leading-7 text-muted">
        <p>本服务是私人学习用途的考试练习工具。用户应使用本人账号登录，不得转售、共享付费权限或批量抓取内容。</p>
        <p>练习内容、答案、作文、录音和学习记录仅用于提供模考、复盘、错题、生词本和账号同步功能。</p>
        <p>平台可能因内容导入、支付通道维护或系统升级暂时调整服务。已付费权益会按订单和退款规则处理。</p>
        <p>用户应确保上传、导入或保存的资料拥有合法使用权。不得使用本服务处理违法、侵权或侵犯他人隐私的内容。</p>
      </div>
      <div className="mt-6"><Button href="/account">Back to account</Button></div>
    </main>
  );
}
