import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>PAオーダーシート</strong>
          <span>管理者ログイン</span>
        </div>
        <a className="button secondary" href="/">
          提出フォーム
        </a>
      </header>
      <section className="container narrow">
        <form className="panel grid" action={login}>
          <div>
            <h1>管理者ログイン</h1>
            <p>提出された内容はログイン後にバンドごとに確認できます。</p>
          </div>
          {params.error ? <div className="error">パスワードが違います。</div> : null}
          <input name="next" type="hidden" value={params.next || "/admin"} />
          <label className="field">
            <span>管理者パスワード</span>
            <input className="input" name="password" required type="password" />
          </label>
          <div className="actions">
            <button className="button" type="submit">
              ログイン
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
