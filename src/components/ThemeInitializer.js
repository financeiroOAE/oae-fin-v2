"use client";

import { useEffect } from 'react';

const THEMES = new Set(['original', 'preto', 'cinza', 'branco']);

export default function ThemeInitializer() {
  useEffect(() => {
    const savedTheme = localStorage.getItem('oae_panel_theme');
    const theme = THEMES.has(savedTheme) ? savedTheme : 'preto';
    document.documentElement.dataset.theme = theme;
  }, []);

  return null;
}
