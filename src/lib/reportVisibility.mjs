// A análise de viabilidade fica visível para usuários autorizados a Projetos.
// A liberação do botão não amplia as permissões de acesso às demais abas.
export function resolveProjectViabilityAccess(user) {
  const isActive = Boolean(user && user.isActive !== false && !user.mustChangePass);
  const admin = isActive && user.role === "ADMIN";
  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  return {
    canView: isActive && (admin || permissions.includes("projetos")),
    // Preserva a regra anterior de emissão exclusivamente pelo ADMIN principal.
    canExport: admin && String(user.username || "").trim().toLowerCase() === "admin",
  };
}
