"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const ReportContext = createContext(null);

const ITEMS_STORAGE_KEY = "oae_report_items_v2";
const CONFIG_STORAGE_KEY = "oae_report_config_v2";
const TEMPLATES_STORAGE_KEY = "oae_report_templates_v2";
const MAX_PERSISTED_ROWS = 500;

function normalizeReportText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function isExcludedExecutiveSection(section) {
  const text = normalizeReportText([
    section?.sectionKey,
    section?.title,
    section?.componentName,
  ].filter(Boolean).join(" "));
  return text.includes("EQUIPE") && text.includes("PROJETO");
}

function sanitizeReportItems(items) {
  return Array.isArray(items) ? items.filter((item) => !isExcludedExecutiveSection(item)) : [];
}

function sanitizeReportTemplates(templates) {
  if (!Array.isArray(templates)) return [];
  return templates.map((template) => ({
    ...template,
    sections: Array.isArray(template.sections)
      ? template.sections.filter((section) => !isExcludedExecutiveSection(section))
      : [],
  }));
}

const defaultConfig = {
  title: "Relatório Financeiro Executivo",
  orientation: "auto",
  includeExplanations: true,
};

function createId(prefix = "report") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function parseStoredValue(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function cloneRows(rows) {
  if (!Array.isArray(rows)) return rows ?? [];
  return rows.map((row) => {
    if (!row || typeof row !== "object") return row;
    return { ...row };
  });
}

function snapshotSection(section) {
  const dataSets = section.dataSets
    ? Object.fromEntries(
        Object.entries(section.dataSets).map(([key, rows]) => [key, cloneRows(rows)])
      )
    : undefined;

  return {
    ...section,
    sectionKey: section.sectionKey || `${section.page}:${section.title}`,
    data: cloneRows(section.data),
    dataSets,
    pendingData: cloneRows(section.pendingData),
    capturedAt: new Date().toISOString(),
  };
}

function sectionFingerprint(section) {
  try {
    const { capturedAt, capturedImage, ...comparable } = section || {};
    void capturedAt;
    void capturedImage;
    return JSON.stringify(comparable);
  } catch {
    return `${section?.sectionKey || ""}:${section?.title || ""}:${section?.page || ""}`;
  }
}

function reportSourceFingerprint(section) {
  try {
    const {
      id,
      capturedAt,
      capturedImage,
      restoredWithoutImage,
      detailMode,
      ...comparable
    } = section || {};
    void id;
    void capturedAt;
    void capturedImage;
    void restoredWithoutImage;
    void detailMode;
    return JSON.stringify(comparable);
  } catch {
    return `${section?.sectionKey || ""}:${section?.title || ""}:${section?.page || ""}`;
  }
}

function makePersistableItem(item) {
  const persistedSets = item.dataSets
    ? Object.fromEntries(
        Object.entries(item.dataSets).map(([key, rows]) => [
          key,
          Array.isArray(rows) ? rows.slice(0, MAX_PERSISTED_ROWS) : rows,
        ])
      )
    : undefined;

  return {
    ...item,
    capturedImage: undefined,
    data: Array.isArray(item.data) ? item.data.slice(0, MAX_PERSISTED_ROWS) : item.data,
    dataSets: persistedSets,
    pendingData: Array.isArray(item.pendingData)
      ? item.pendingData.slice(0, MAX_PERSISTED_ROWS)
      : item.pendingData,
    restoredWithoutImage: Boolean(item.capturedImage),
  };
}

export function ReportProvider({ children }) {
  const [isReportMode, setIsReportMode] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeReportPage, setActiveReportPage] = useState(null);
  const [reportItems, setReportItems] = useState([]);
  const [reportConfig, setReportConfig] = useState(defaultConfig);
  const [templates, setTemplates] = useState([]);
  const [availableSections, setAvailableSections] = useState({});
  const [statusMessage, setStatusMessage] = useState("");
  const hydratedRef = useRef(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const savedItems = parseStoredValue(ITEMS_STORAGE_KEY, []);
      const savedConfig = parseStoredValue(CONFIG_STORAGE_KEY, defaultConfig);
      const savedTemplates = parseStoredValue(TEMPLATES_STORAGE_KEY, []);

      setReportItems(sanitizeReportItems(savedItems));
      setReportConfig({ ...defaultConfig, ...(savedConfig || {}) });
      setTemplates(sanitizeReportTemplates(savedTemplates));
      hydratedRef.current = true;
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      localStorage.setItem(
        ITEMS_STORAGE_KEY,
        JSON.stringify(reportItems.map(makePersistableItem))
      );
    } catch {
      // O relatório completo continua disponível em memória nesta sessão.
    }
  }, [reportItems]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(reportConfig));
    } catch {
      // A configuração continua disponível em memória nesta sessão.
    }
  }, [reportConfig]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
    } catch {
      // Modelos permanecem disponíveis até o fim da sessão.
    }
  }, [templates]);

  const openReportBuilder = useCallback((page) => {
    if (page) setActiveReportPage(page);
    setIsReportMode(true);
    setIsDrawerOpen(true);
  }, []);

  const toggleReportMode = useCallback((page) => {
    setIsReportMode((current) => {
      const next = !current;
      if (next) {
        if (page) setActiveReportPage(page);
        setIsDrawerOpen(true);
      }
      return next;
    });
  }, []);

  const exitReportMode = useCallback(() => {
    setIsReportMode(false);
    setIsDrawerOpen(false);
    setActiveReportPage(null);
  }, []);

  const registerSection = useCallback((section) => {
    if (isExcludedExecutiveSection(section)) return;
    if (!section?.sectionKey && (!section?.page || !section?.title)) return;
    const normalized = snapshotSection(section);

    setAvailableSections((current) => {
      const existing = current[normalized.sectionKey];
      if (existing && sectionFingerprint(existing) === sectionFingerprint(normalized)) {
        return current;
      }
      return { ...current, [normalized.sectionKey]: normalized };
    });

    // Um bloco ja adicionado deve sempre refletir o estado ATUAL da pagina.
    // Se projeto, empresa, tipo, periodo, rateio ou qualquer dado do bloco mudar,
    // renovamos o snapshot usado pelo relatorio. Mantemos apenas as escolhas do
    // usuario (id e nivel de detalhe). Uma imagem capturada anteriormente e
    // descartada para nunca exportar um grafico de filtros antigos.
    setReportItems((current) => {
      let changed = false;
      const next = current.map((item) => {
        if (item.sectionKey !== normalized.sectionKey) return item;

        if (reportSourceFingerprint(item) === reportSourceFingerprint(normalized)) {
          return item;
        }

        changed = true;
        return {
          ...normalized,
          id: item.id,
          detailMode: item.detailMode ?? normalized.detailMode,
          capturedImage: undefined,
          restoredWithoutImage: Boolean(item.capturedImage) || Boolean(item.restoredWithoutImage),
          capturedAt: new Date().toISOString(),
        };
      });
      return changed ? next : current;
    });
  }, []);

  const unregisterSection = useCallback((sectionKey) => {
    if (!sectionKey) return;
    setAvailableSections((current) => {
      if (!current[sectionKey]) return current;
      const next = { ...current };
      delete next[sectionKey];
      return next;
    });
  }, []);

  const addReportItem = useCallback((section) => {
    if (isExcludedExecutiveSection(section)) return;
    const normalized = snapshotSection(section);
    setReportItems((current) => {
      if (current.some((item) => item.sectionKey === normalized.sectionKey)) {
        return current;
      }
      return [...current, { ...normalized, id: createId("item") }];
    });
    setStatusMessage(`“${normalized.title}” adicionado ao relatório.`);
  }, []);

  const updateReportItem = useCallback((id, changes) => {
    setReportItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item))
    );
  }, []);

  const removeReportItem = useCallback((id) => {
    setReportItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const reorderReportItems = useCallback((startIndex, endIndex) => {
    setReportItems((current) => {
      if (
        startIndex === endIndex ||
        startIndex < 0 ||
        endIndex < 0 ||
        startIndex >= current.length ||
        endIndex >= current.length
      ) {
        return current;
      }
      const result = [...current];
      const [moved] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, moved);
      return result;
    });
  }, []);

  const reorderReportPageItems = useCallback((page, startIndex, endIndex) => {
    setReportItems((current) => {
      const pagePositions = current.reduce((positions, item, index) => {
        if (item.page === page) positions.push(index);
        return positions;
      }, []);
      if (
        startIndex === endIndex ||
        startIndex < 0 ||
        endIndex < 0 ||
        startIndex >= pagePositions.length ||
        endIndex >= pagePositions.length
      ) {
        return current;
      }
      const orderedPageItems = pagePositions.map((position) => current[position]);
      const [moved] = orderedPageItems.splice(startIndex, 1);
      orderedPageItems.splice(endIndex, 0, moved);
      const result = [...current];
      pagePositions.forEach((position, index) => {
        result[position] = orderedPageItems[index];
      });
      return result;
    });
  }, []);

  const clearReport = useCallback(() => {
    setReportItems([]);
    setStatusMessage("Seleção do relatório limpa.");
  }, []);

  const clearReportPage = useCallback((page) => {
    if (!page) return;
    setReportItems((current) => current.filter((item) => item.page !== page));
    setStatusMessage(`Seleção de ${page} limpa.`);
  }, []);

  const applyPreset = useCallback(
    (presetTag) => {
      const matches = Object.values(availableSections).filter((section) =>
        !isExcludedExecutiveSection(section) &&
        section.presetTags?.includes(presetTag) &&
        (!activeReportPage || section.page === activeReportPage)
      );

      if (matches.length === 0) {
        setStatusMessage(
          "Abra a página correspondente para carregar os blocos deste modelo."
        );
        return 0;
      }

      setReportItems((current) => {
        const currentKeys = new Set(current.map((item) => item.sectionKey));
        const additions = matches
          .filter((section) => !currentKeys.has(section.sectionKey))
          .map((section) => ({ ...snapshotSection(section), id: createId("item") }));
        return [...current, ...additions];
      });
      setStatusMessage(`${matches.length} bloco(s) do modelo foram carregados.`);
      return matches.length;
    },
    [activeReportPage, availableSections]
  );

  const saveTemplate = useCallback(
    (name) => {
      const cleanName = String(name || "").trim();
      if (!cleanName || reportItems.length === 0) return false;

      const template = {
        id: createId("template"),
        name: cleanName,
        createdAt: new Date().toISOString(),
        config: reportConfig,
        sections: reportItems.map((item) => ({
          sectionKey: item.sectionKey,
          title: item.title,
          page: item.page,
          detailMode: item.detailMode,
          includePending: item.includePending,
        })),
      };

      setTemplates((current) => [
        template,
        ...current.filter((item) => item.name.toLowerCase() !== cleanName.toLowerCase()),
      ]);
      setStatusMessage(`Modelo “${cleanName}” salvo neste navegador.`);
      return true;
    },
    [reportConfig, reportItems]
  );

  const loadTemplate = useCallback(
    (templateId) => {
      const template = templates.find((item) => item.id === templateId);
      if (!template) return { loaded: 0, missing: 0 };

      const previousByKey = Object.fromEntries(
        reportItems.map((item) => [item.sectionKey, item])
      );
      let missing = 0;
      const loadedItems = template.sections.flatMap((reference) => {
        const source =
          availableSections[reference.sectionKey] || previousByKey[reference.sectionKey];
        if (!source) {
          missing += 1;
          return [];
        }

        const item = snapshotSection(source);
        const detailMode = reference.detailMode || item.detailMode;
        const data = detailMode && item.dataSets?.[detailMode]
          ? cloneRows(item.dataSets[detailMode])
          : cloneRows(item.data);

        return [{
          ...item,
          id: createId("item"),
          detailMode,
          includePending: Boolean(reference.includePending),
          data,
        }];
      });

      setReportItems(loadedItems);
      setReportConfig({ ...defaultConfig, ...(template.config || {}) });
      setStatusMessage(
        missing > 0
          ? `${loadedItems.length} bloco(s) carregado(s). Visite as páginas de ${missing} bloco(s) ausente(s) e carregue novamente.`
          : `Modelo “${template.name}” carregado.`
      );
      return { loaded: loadedItems.length, missing };
    },
    [availableSections, reportItems, templates]
  );

  const deleteTemplate = useCallback((templateId) => {
    setTemplates((current) => current.filter((item) => item.id !== templateId));
  }, []);

  return (
    <ReportContext.Provider
      value={{
        isReportMode,
        setIsReportMode,
        activeReportPage,
        setActiveReportPage,
        toggleReportMode,
        openReportBuilder,
        exitReportMode,
        isDrawerOpen,
        setIsDrawerOpen,
        reportItems,
        addReportItem,
        updateReportItem,
        removeReportItem,
        reorderReportItems,
        reorderReportPageItems,
        clearReport,
        clearReportPage,
        setReportItems,
        reportConfig,
        setReportConfig,
        templates,
        saveTemplate,
        loadTemplate,
        deleteTemplate,
        registerSection,
        unregisterSection,
        availableSections,
        applyPreset,
        statusMessage,
        setStatusMessage,
      }}
    >
      {children}
    </ReportContext.Provider>
  );
}

export function useReport() {
  const context = useContext(ReportContext);
  if (!context) {
    throw new Error("useReport precisa ser usado dentro de ReportProvider");
  }
  return context;
}
