import { logout } from "./login/actions";

const links = [
  { href: "/admin", label: "提出一覧" },
  { href: "/admin/live-orders", label: "演奏順管理" },
  { href: "/admin/settings/live-events", label: "ライブ設定" },
];

export function AdminHeader({ title }: { title: string }) {
  return (
    <header className="topbar">
      <a className="brand" href="/admin">
        <strong>PAオーダーシート</strong>
        <span>{title}</span>
      </a>
      <nav className="actions" aria-label="管理メニュー">
        {links.map((link) => (
          <a className="button secondary" href={link.href} key={link.href}>
            {link.label}
          </a>
        ))}
        <form action={logout}>
          <button className="button secondary" type="submit">
            ログアウト
          </button>
        </form>
      </nav>
    </header>
  );
}
