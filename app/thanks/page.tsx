export default async function ThanksPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  const editPath = params.token ? `/orders/${params.token}` : "";

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
          <p>PAオーダーシートを受け付けました。</p>
          {editPath ? (
            <div className="share-link">
              <span>確認・編集用URL</span>
              <a href={editPath}>{editPath}</a>
            </div>
          ) : null}
          <div className="actions">
            <a className="button" href="/">
              もう一件提出する
            </a>
            {editPath ? (
              <a className="button secondary" href={editPath}>
                提出内容を確認する
              </a>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
