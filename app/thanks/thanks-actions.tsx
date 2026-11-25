"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { draftKey, removeDraft } from "@/lib/draft";

export function ThanksActions({ editPath }: { editPath: string }) {
  const [fullUrl, setFullUrl] = useState(editPath);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // 旧フォームの新規提出用の下書きを消す（他のバンドの下書きには触れない）
    removeDraft(draftKey(null, null));
    setFullUrl(`${window.location.origin}${editPath}`);
  }, [editPath]);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <div className="share-link">
        <span>確認・編集URL</span>
        <a href={editPath}>{fullUrl}</a>
        <Button variant="secondary" onPress={copyUrl}>
          URLをコピー
        </Button>
        <span aria-live="polite">{copied ? "コピーしました" : ""}</span>
      </div>
      <p className="security-note">このURLを知っている人は提出内容を編集できます。必要な相手以外には共有しないでください。</p>
      <div className="actions">
        <a className="button primary" href={editPath}>
          提出内容を確認する
        </a>
        <a className="button secondary" href="/">
          新しく提出する
        </a>
      </div>
    </>
  );
}
