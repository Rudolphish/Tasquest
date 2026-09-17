'use client';

import { useEffect } from 'react';

/**
 * URL のフラグメントを取り除く。
 *
 * 使用済みのマジックリンクを踏むと、Supabase がエラーをフラグメントに載せて
 * 返す。フラグメントはサーバーへ送られないため転送では落ちず、ブラウザが
 * 転送先まで引き継ぐ。アプリの状態とは無関係だが、URL に残ると紛らわしい。
 */
export function ClearHash() {
  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  return null;
}
