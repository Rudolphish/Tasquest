import { requireUser } from '@/lib/auth';
import { ClearHash } from '@/components/clear-hash';

/**
 * ログインを要求するレイアウト。
 *
 * ただし、これを唯一の防衛線にしない。個々のページでも所有者を確認する。
 * レイアウトでの判定は「ログインしているか」しか見ておらず、
 * 「その資源を見てよいか」は判定できないため。
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();

  return (
    <div className="shell">
      <ClearHash />
      {children}
    </div>
  );
}
