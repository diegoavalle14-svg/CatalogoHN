import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { API_PUBLIC_ORIGIN } from '../lib/api';

export function money(value) {
  return `L.\u00A0${Number(value || 0).toLocaleString('es-HN', { minimumFractionDigits: 2 })}`;
}

export function stockMeta(product) {
  const stock = Number(product?.stock_actual ?? 0);
  const minimum = Number(product?.stock_minimo ?? 0);
  if (stock <= 0) return { stock, label: 'Agotado', tone: 'out' };
  if (minimum > 0 && stock <= minimum) return { stock, label: `Quedan ${stock}`, tone: 'low' };
  return { stock, label: `Stock ${stock}`, tone: 'ok' };
}

export function resolveMediaUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (typeof window === 'undefined') return raw;

  if (raw.startsWith('/uploads/')) {
    return `${API_PUBLIC_ORIGIN}${raw}`;
  }

  try {
    const url = new URL(raw);
    if (['localhost', '127.0.0.1'].includes(url.hostname)) {
      url.hostname = window.location.hostname;
    }
    return url.toString();
  } catch {
    return raw;
  }
}

export const isToday = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
};

export function ThemeToggle({ theme, onToggle, label = '' }) {
  const isDark = theme === 'dark';
  const Icon = isDark ? Sun : Moon;
  return (
    <button
      className="theme-toggle-button"
      type="button"
      onClick={onToggle}
      aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
    >
      <Icon size={15} />
      {label && <span>{label}</span>}
    </button>
  );
}

export function ProductStockPill({ product, className = '' }) {
  const stock = stockMeta(product);
  return <span className={`stock-pill ${stock.tone} ${className}`.trim()}>{stock.label}</span>;
}

export function TenantLogoMark({ tenant, size = 'normal' }) {
  const label = tenant?.nombre || 'Empresa';
  const logoUrl = resolveMediaUrl(tenant?.logo_url);
  const hasLogo = Boolean(logoUrl);
  return (
    <span className={`logo-mark tenant-logo-mark ${size === 'small' ? 'small' : ''} ${hasLogo ? 'has-logo' : 'needs-logo'}`}>
      {hasLogo ? (
        <img src={logoUrl} alt={`Logo de ${label}`} />
      ) : (
        <>
          <b>Logo</b>
        </>
      )}
    </span>
  );
}
