import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';

export function useChatHistory(token) {
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const epoch = useRef(0);
  const locked = useRef(false);

  useEffect(() => {
    const current = ++epoch.current;
    // Clear account-scoped state when the authenticated token changes.
    // eslint-disable-next-line react/set-state-in-effect
    setItems([]);
    setActive(null);
    setError('');
    setHasMore(false);
    setBusy(false);
    locked.current = false;
    setLoading(Boolean(token));
    if (token) api.getConversations(token).then((result) => {
      if (epoch.current !== current) return;
      setItems(result.items);
      setHasMore(result.hasMore);
    }).catch((err) => { if (epoch.current === current) setError(err.message); })
      .finally(() => { if (epoch.current === current) setLoading(false); });
    // This is a request-generation counter, not a DOM ref; invalidate late responses on cleanup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { epoch.current++; };
  }, [token]);

  async function loadMore(retry = false) {
    if (locked.current) return;
    locked.current = true;
    setLoading(true);
    const current = epoch.current;
    try {
      const result = await api.getConversations(token, retry ? 0 : items.length);
      if (current !== epoch.current) return;
      setItems((previous) => retry ? result.items : [...previous, ...result.items.filter((item) => !previous.some((old) => old.id === item.id))]);
      setHasMore(result.hasMore);
      setError('');
    } catch (err) { if (current === epoch.current) setError(err.message); }
    finally { if (current === epoch.current) { locked.current = false; setLoading(false); } }
  }

  async function open(id) {
    if (locked.current || loading) return;
    locked.current = true;
    setBusy(true);
    const current = epoch.current;
    try {
      const conversation = await api.getConversation(token, id);
      if (current !== epoch.current) return;
      setActive(conversation);
      setError('');
    } catch (err) { if (current === epoch.current) setError(err.message); }
    finally { if (current === epoch.current) { locked.current = false; setBusy(false); } }
  }

  async function send(prepareQuestion) {
    if (locked.current) throw new Error('Please wait for the current request.');
    locked.current = true;
    setBusy(true);
    const current = epoch.current;
    try {
      const question = await prepareQuestion();
      if (current !== epoch.current) return;
      const { conversation } = await api.askInConversation(token, question, active?.id);
      if (current !== epoch.current) return;
      setActive(conversation);
      const metadata = { id: conversation.id, title: conversation.title, createdAt: conversation.createdAt, updatedAt: conversation.updatedAt };
      setItems((previous) => [metadata, ...previous.filter((item) => item.id !== conversation.id)]);
      setError('');
    } finally { if (current === epoch.current) { locked.current = false; setBusy(false); } }
  }

  function startNew() {
    if (locked.current || loading) return;
    setActive(null);
    setError('');
  }
  return { items, active, loading, busy, error, hasMore, open, send, startNew, loadMore };
}
