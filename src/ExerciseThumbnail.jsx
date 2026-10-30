import React, { useEffect, useState } from 'react';
import TrainingIcon, { exerciseGlyph } from './TrainingIcon.jsx';
import { safeWebUrl } from './exerciseGuide.mjs';

export default function ExerciseThumbnail({ exercise, notionAvailable, onOpen }) {
  const original = exercise.images?.map(image => safeWebUrl(image.url)).find(Boolean) || '';
  const [url, setUrl] = useState(original);
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(false);
  useEffect(() => { setUrl(original); setFailed(false); setRefresh(false); }, [exercise.id, original]);
  // Signed Notion image URLs expire. Refresh only the visible failed thumbnail,
  // through the same authenticated, read-only guide endpoint.
  useEffect(() => {
    if (!failed || refresh || !notionAvailable) return;
    const controller = new AbortController();
    setRefresh(true);
    fetch(`/api/exercises?id=${encodeURIComponent(exercise.notionPageId || exercise.id)}`, { signal: controller.signal, cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(data => { const next = data?.exercise?.images?.map(image => safeWebUrl(image.url)).find(Boolean); if (!controller.signal.aborted && next && next !== url) { setUrl(next); setFailed(false); } })
      .catch(() => {});
    return () => controller.abort();
  }, [failed, notionAvailable, exercise.id, exercise.notionPageId, url]);
  return <button type="button" className="flex-exercise-thumb" onClick={onOpen} aria-label={`View details for ${exercise.name}`}>
    {url && !failed ? <img src={url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <TrainingIcon name={exerciseGlyph(exercise)} />}
  </button>;
}
