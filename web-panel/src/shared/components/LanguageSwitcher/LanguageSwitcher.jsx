import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './LanguageSwitcher.css';

const LANGS = [
  { code: 'tr', label: 'TR' },
  { code: 'en', label: 'EN' },
];

export const LanguageSwitcher = ({ compact = false, className = '' }) => {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  const active = useMemo(() => {
    const lng = (i18n.resolvedLanguage || i18n.language || 'tr').toLowerCase();
    return LANGS.find(l => lng.startsWith(l.code)) || LANGS[0];
  }, [i18n.language, i18n.resolvedLanguage]);

  const setLang = useCallback(async (code) => {
    try {
      await i18n.changeLanguage(code);
      // Ensure detector cache is updated even if config changes.
      localStorage.setItem('i18nextLng', code);
    } finally {
      setOpen(false);
    }
  }, [i18n]);

  return (
    <div className={`lang-switch ${compact ? 'compact' : ''} ${className}`.trim()}>
      <button
        type="button"
        className="lang-btn"
        onClick={() => setOpen(v => !v)}
        aria-label="Change language"
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

