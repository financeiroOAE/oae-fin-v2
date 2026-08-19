"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = { username, password };
      if (needsPasswordChange) {
        if (!newPassword || newPassword.length < 8) {
          throw new Error("A nova senha deve ter no mínimo 8 caracteres.");
        }
        payload.newPassword = newPassword;
      }

      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Erro no servidor: Resposta inesperada (não é JSON).");
      }

      const data = await res.json();

      if (res.ok) {
        router.push("/");
      } else if (data.mustChangePass) {
        setNeedsPasswordChange(true);
        setPassword("");
        setError("É necessário definir uma nova senha para o primeiro acesso.");
      } else {
        setError(data.error || "Credenciais inválidas");
      }
    } catch (err) {
      setError(err.message || "Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      backgroundColor: "var(--bg-main)",
      backgroundImage: "radial-gradient(circle at top right, rgba(57, 198, 198, 0.05), transparent 40%)",
      padding: "1.25rem",
    }}>
      <div className="card" style={{
        width: "100%",
        maxWidth: "440px",
        padding: "2.25rem",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
      }}>
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.7rem",
            marginBottom: "1rem",
            padding: "0.5rem 0",
            minHeight: "145px",
            borderRadius: "12px",
            background: "transparent",
          }}>
            <img
              src="/logo.png"
              alt="Símbolo Oliveira Araújo Engenharia"
              style={{ width: "82px", height: "82px", objectFit: "contain", display: "block" }}
            />
            <div style={{ lineHeight: 1, color: "var(--text-main)" }}>
              <div style={{ fontSize: "1.42rem", fontWeight: 800, letterSpacing: "0.055em", whiteSpace: "nowrap" }}>
                OLIVEIRA ARAÚJO
              </div>
              <div style={{ marginTop: "0.55rem", fontSize: "0.76rem", fontWeight: 700, letterSpacing: "0.42em", color: "var(--text-secondary)", paddingLeft: "0.42em" }}>
                ENGENHARIA
              </div>
            </div>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
            Acesso Restrito Corporativo
          </p>
        </div>

        {error && (
          <div style={{
            background: needsPasswordChange ? "rgba(245, 158, 11, 0.1)" : "rgba(239, 68, 68, 0.1)",
            border: `1px solid ${needsPasswordChange ? "var(--warning)" : "var(--danger)"}`,
            color: needsPasswordChange ? "#fbbf24" : "#f87171",
            padding: "0.75rem",
            borderRadius: "6px",
            marginBottom: "1.5rem",
            fontSize: "0.875rem",
            textAlign: "center",
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
              Usuário
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={needsPasswordChange || loading}
              autoComplete="username"
              style={{ padding: "0.875rem" }}
              placeholder="Digite seu usuário"
            />
          </div>

          {!needsPasswordChange ? (
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="current-password"
                style={{ padding: "0.875rem" }}
                placeholder="Digite sua senha"
              />
            </div>
          ) : (
            <>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                  Senha Atual (Provisória)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="current-password"
                  style={{ padding: "0.875rem" }}
                  placeholder="Confirme a senha provisória"
                />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", color: "var(--primary)" }}>
                  Nova Senha Definitiva
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="new-password"
                  style={{ padding: "0.875rem", borderColor: "var(--primary)" }}
                  placeholder="No mínimo 8 caracteres"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ marginTop: "0.5rem", padding: "0.875rem", fontSize: "1rem", opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Processando..." : needsPasswordChange ? "Atualizar Senha e Entrar" : "Entrar"}
          </button>
        </form>

        <div style={{ marginTop: "2rem", textAlign: "center", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
          Oliveira Araújo Engenharia &copy; {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
