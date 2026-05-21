import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './LanguageSwitcher.css';

const LANGS = [
  { code: 'tr', label: 'TR' },
  { code: 'en', label: 'EN' },
];

export const LanguageSwitcher = ({ compact = false, className = '' }) => {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const active = useMemo(() => {
    const lng = (i18n.resolvedLanguage || i18n.language || 'tr').toLowerCase();
    return LANGS.find(l => lng.startsWith(l.code)) || LANGS[0];
  }, [i18n.language, i18n.resolvedLanguage]);

  const setLang = useCallback(async (code) => {
    try {
      await i18n.changeLanguage(code);
      localStorage.setItem('i18nextLng', code);
    } finally {
      setOpen(false);
    }
  }, [i18n]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div ref={rootRef} className={`lang-switch ${compact ? 'compact' : ''} ${className}`.trim()}>
      <button
        type="button"
        className="lang-btn"
        onClick={() => setOpen(v => !v)}
        aria-label="Change language"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="lang-globe" aria-hidden="true">🌐</span>
        <span className="lang-code">{active.label}</span>
        <span className="lang-caret" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="lang-menu" role="menu">
          {LANGS.map(l => (
            <button
              key={l.code}
              type="button"
              role="menuitem"
              className={`lang-item ${active.code === l.code ? 'active' : ''}`}
              onClick={() => setLang(l.code)}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

