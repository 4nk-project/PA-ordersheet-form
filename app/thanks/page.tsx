export default function ThanksPage() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>PAオーダーシート</strong>
          <span>提出完了</span>
        </div>
      </header>
      <section className="container narrow">
        <div className="panel">
          <h1>提出が完了しました</h1>
          <p>PAオーダーシートを受け付けました。内容は管理者画面でバンドごとに確認できます。</p>
          <div className="actions">
            <a className="button" href="/">
              もう一件提出する
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
