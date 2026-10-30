import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { findExerciseGuide, safeWebUrl } from './exerciseGuide.mjs';

export function ExerciseInfoButton({ exercise, onClick, className = '' }) {
  return (
    <button type="button" className={`exercise-info-button ${className}`}
      aria-label={`View details for ${exercise.name}`} title="Exercise details" onClick={onClick}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><circle cx="12" cy="7.5" r=".9" fill="currentColor" stroke="none" />
      </svg>
    </button>
  );
}

function GuideText({ text }) {
  const groups = [];
  String(text || '').split('\n').map(line => line.trim()).filter(Boolean).forEach(line => {
    const ordered = /^\d+[.)]\s+/.test(line);
    const bullet = /^[-•]\s+/.test(line);
    const type = ordered ? 'ol' : bullet ? 'ul' : 'p';
    const content = line.replace(/^(?:\d+[.)]|[-•])\s+/, '');
    const previous = groups[groups.length - 1];
    if (type !== 'p' && previous?.type === type) previous.lines.push(content);
    else groups.push({ type, lines: [content] });
  });
  return groups.map(({ type: Tag, lines }, index) => (
    <Tag key={index}>{Tag === 'p' ? lines[0] : lines.map((line, i) => <li key={i}>{line}</li>)}</Tag>
  ));
}

export default function ExerciseGuide({ exercise, library, notionAvailable, appearanceStyle, onClose }) {
  const libraryItem = findExerciseGuide(exercise, library);
  const [guide, setGuide] = useState(libraryItem);
  const [loading, setLoading] = useState(notionAvailable);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [failedImages, setFailedImages] = useState([]);
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setFailedImages([]);
    setError('');
    if (!notionAvailable) {
      setLoading(false);
      return () => controller.abort();
    }
    setLoading(true);
    (async () => {
      try {
        const response = await fetch(libraryItem
          ? `/api/exercises?id=${encodeURIComponent(libraryItem.notionPageId || libraryItem.id)}` : '/api/exercises',
        { signal: controller.signal, cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error('Guide request failed');
        const updated = libraryItem ? data.exercise : findExerciseGuide(exercise, data.exercises);
        if (!controller.signal.aborted) setGuide(updated || null);
      } catch (err) {
        if (!controller.signal.aborted) setError('Couldn’t load the latest exercise details. Please try again.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [exercise, libraryItem?.id, notionAvailable, attempt]);

  const sourceUrl = safeWebUrl(guide?.sourceUrl);
  const images = (guide?.images || []).filter(image => safeWebUrl(image.url));
  const hasDetails = Boolean(images.length || guide?.musclesWorked || guide?.instructions || guide?.commonMistakes || sourceUrl);
  const retry = () => setAttempt(value => value + 1);

  return createPortal(
    <dialog ref={dialogRef} className={`exercise-guide${appearanceStyle ? ' training-guide' : ''}`} style={appearanceStyle} aria-labelledby="exercise-guide-title" aria-modal="true"
      onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const controls = [...event.currentTarget.querySelectorAll('button:not(:disabled), a[href]')]
          .filter(element => element.getClientRects().length);
        const index = controls.indexOf(document.activeElement);
        const next = (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
        event.preventDefault();
        controls[next]?.focus();
      }}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      }}>
      <header className="exercise-guide-header">
        <div><p className="exercise-guide-eyebrow">Exercise guide</p><h2 id="exercise-guide-title">{guide?.name || exercise.name}</h2></div>
        <button type="button" className="exercise-guide-close" onClick={onClose} autoFocus aria-label="Close exercise details">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </header>
      <div className="exercise-guide-body" aria-busy={loading}>
        {loading && <p className="exercise-guide-status" role="status">Loading exercise details…</p>}
        {error && <div className="exercise-guide-status" role="alert"><p>{error}</p><button type="button" onClick={retry}>Try again</button></div>}
        {!loading && !error && !hasDetails && <p className="exercise-guide-empty">No guide has been added for this exercise yet.</p>}
        {images.map((image, index) => (
          <figure className="exercise-guide-image" key={`${image.url}-${attempt}`}>
            {failedImages.includes(index) ? (
              <div className="exercise-guide-image-error"><p>Illustration unavailable.</p><button type="button" onClick={retry} disabled={loading}>Reload image</button></div>
            ) : (
              <a href={safeWebUrl(image.url)} target="_blank" rel="noopener noreferrer" aria-label={`Open full-size illustration of ${guide.name}`}>
                <img src={safeWebUrl(image.url)} alt={`${guide.name} — exercise illustration${images.length > 1 ? ` ${index + 1}` : ''}`}
                  onError={() => setFailedImages(previous => [...previous, index])} />
                <figcaption>Tap image to enlarge <span aria-hidden="true">↗</span></figcaption>
              </a>
            )}
          </figure>
        ))}
        {guide?.musclesWorked && <section className="exercise-guide-section">
          <h3>Muscles worked</h3>
          <dl className="exercise-guide-muscles">{guide.musclesWorked.split('\n').filter(line => line.trim()).map((line, index) => {
            const split = line.indexOf(' — ');
            return split < 0 ? <div key={index}><dt>{line}</dt></div> : <div key={index}><dt>{line.slice(0, split)}</dt><dd>{line.slice(split + 3)}</dd></div>;
          })}</dl>
        </section>}
        {guide?.instructions && <section className="exercise-guide-section"><h3>Instructions</h3><GuideText text={guide.instructions} /></section>}
        {guide?.commonMistakes && <section className="exercise-guide-section"><h3>Common mistakes</h3><GuideText text={guide.commonMistakes} /></section>}
        {sourceUrl && <a className="exercise-guide-source" href={sourceUrl} target="_blank" rel="noopener noreferrer">
          <span><strong>Further information</strong><span>{new URL(sourceUrl).hostname.replace(/^www\./, '')}</span></span><span aria-hidden="true">↗</span>
        </a>}
      </div>
    </dialog>, document.body
  );
}
