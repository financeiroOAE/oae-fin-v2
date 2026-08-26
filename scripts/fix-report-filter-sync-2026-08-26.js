const fs = require('fs');

const path = 'src/contexts/ReportContext.js';
let content = fs.readFileSync(path, 'utf8');

const fingerprintAnchor = `function sectionFingerprint(section) {
  try {
    const { capturedAt, capturedImage, ...comparable } = section || {};
    void capturedAt;
    void capturedImage;
    return JSON.stringify(comparable);
  } catch {
    return \`${'${section?.sectionKey || ""}:${section?.title || ""}:${section?.page || ""}'}\`;
  }
}
`;

const fingerprintReplacement = `${fingerprintAnchor}
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
    return \`${'${section?.sectionKey || ""}:${section?.title || ""}:${section?.page || ""}'}\`;
  }
}
`;

if (!content.includes(fingerprintAnchor)) {
  throw new Error('Ancora sectionFingerprint nao encontrada');
}
content = content.replace(fingerprintAnchor, fingerprintReplacement);

const oldRegister = `  const registerSection = useCallback((section) => {
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
  }, []);`;

const newRegister = `  const registerSection = useCallback((section) => {
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
  }, []);`;

if (!content.includes(oldRegister)) {
  throw new Error('Bloco registerSection nao encontrado');
}
content = content.replace(oldRegister, newRegister);

fs.writeFileSync(path, content);
console.log('Relatorios passam a sincronizar automaticamente com os filtros atuais da pagina.');
