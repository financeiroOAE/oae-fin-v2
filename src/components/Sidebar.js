"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import DesignPreviewToggle from '@/components/DesignPreviewToggle';
import { 
  LayoutDashboard, 
  BarChart3,
  Activity, 
  FolderKanban, 
  ChartColumn,
  RefreshCw, 
  History, 
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Menu,
  UsersRound,
  UserRoundCheck
} from 'lucide-react';

export default function Sidebar({ canPreview = false, previewActive = false }) {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [iconError, setIconError] = useState(false);
  const [sessionUser, setSessionUser] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [administrativeOpen, setAdministrativeOpen] = useState(null);
  const pathname = usePathname();

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setCollapsed(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (pathname === '/') {
        setCollapsed(true);
      } else if (!isMobile) {
        const savedState = localStorage.getItem('sidebar_collapsed');
        if (savedState !== null) {
          setCollapsed(JSON.parse(savedState));
        }
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pathname, isMobile]);

  useEffect(() => {
    fetch('/api/session', { cache: 'no-store' })
      .then((response) => response.json())
      .then((result) => setSessionUser(result.user || null))
      .catch(() => setSessionUser(null));
  }, [pathname]);

  const handleToggle = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    if (pathname !== '/' && !isMobile) {
      localStorage.setItem('sidebar_collapsed', JSON.stringify(newState));
    }
  };

  if (pathname === '/login') return null;

  const restrictedManagementMenus = ['equipe_gestao', 'administrativo_geral', 'administrativo_diretoria'];
  const canAccess = (permission) => {
    if (!permission) return false;
    return restrictedManagementMenus.includes(permission)
      ? Boolean(sessionUser && (sessionUser.role === 'ADMIN' || sessionUser.permissions?.includes(permission)))
      : !sessionUser || sessionUser.role === 'ADMIN' || sessionUser.permissions?.includes(permission);
  };
  const isSettingsPath = ['/configuracoes', '/atualizacao-dados', '/historico'].some((path) => pathname.startsWith(path));
  const isAdministrativePath = pathname.startsWith('/administrativo');
  const showSettingsChildren = settingsOpen || isSettingsPath;
  const showAdministrativeChildren = administrativeOpen ?? isAdministrativePath;
  const menuItems = [
    { name: 'Início', path: '/', icon: LayoutDashboard, permission: 'inicio' },
    { name: 'Visão Financeira', path: '/visao-financeira', icon: BarChart3, permission: 'visao_financeira' },
    { name: 'Fluxo de Caixa', path: '/fluxo-caixa', icon: Activity, permission: 'fluxo_caixa' },
    { name: 'Projetos', path: '/projetos', icon: FolderKanban, permission: 'projetos' },
    { name: 'Equipe', path: '/equipe', icon: UsersRound, permission: 'equipe_gestao' },
    {
      name: 'Administrativo', path: '/administrativo', icon: UserRoundCheck, permission: null,
      children: [
        { name: 'Visão Geral', path: '/administrativo', icon: UserRoundCheck, permission: 'administrativo_geral' },
        { name: 'Diretora', path: '/administrativo/socios', icon: UsersRound, permission: 'administrativo_diretoria', subtle: true },
      ],
    },
    { name: 'DRE Gerencial', path: '/dre', icon: ChartColumn, permission: 'dre' },
    {
      name: 'Configurações', path: '/configuracoes', icon: Settings, permission: 'configuracoes',
      children: [
        { name: 'Atualização de Dados', path: '/atualizacao-dados', icon: RefreshCw, permission: 'atualizacao_dados' },
        { name: 'Histórico', path: '/historico', icon: History, permission: 'historico' },
      ],
    },
  ].filter((item) => {
    return canAccess(item.permission) || item.children?.some((child) => canAccess(child.permission));
  });

  return (
    <>
      {isMobile && collapsed && (
        <button 
          onClick={() => setCollapsed(false)}
          style={{ position: 'fixed', top: '1rem', left: '1rem', zIndex: 90, background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', padding: '0.5rem', borderRadius: '8px', color: 'var(--text-main)', boxShadow: 'var(--shadow-md)', cursor: 'pointer' }}>
          <Menu size={20} />
        </button>
      )}
      
      {isMobile && !collapsed && (
        <div onClick={() => setCollapsed(true)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 95 }} />
      )}
      
      <aside className="oae-sidebar" style={{
        width: collapsed && !isMobile ? '72px' : '240px',
        minWidth: collapsed && !isMobile ? '72px' : '240px',
        maxWidth: collapsed && !isMobile ? '72px' : '240px',
        flexShrink: 0,
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-color)',
        // Evita reflow contínuo de gráficos e tabelas durante o recolhimento.
        transition: isMobile ? 'transform 0.18s ease-out' : 'none',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: isMobile ? 'fixed' : 'sticky',
        top: 0,
        left: 0,
        zIndex: 100,
        transform: isMobile && collapsed ? 'translateX(-100%)' : 'none',
      }}>
        {/* Logo Area */}
        <div className="sidebar-brand" style={{
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: (collapsed && !isMobile) ? '0' : '0 1rem',
          borderBottom: '1px solid var(--border-color)',
          position: 'relative'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: (collapsed && !isMobile) ? 'center' : 'flex-start',
            width: '100%',
            height: '100%',
            overflow: 'hidden'
          }}>
            {(collapsed && !isMobile) ? (
              <>
                {!iconError ? (
                  <img src="/logo.png" alt="OAE" 
                    onError={() => setIconError(true)} 
                    style={{ objectFit: 'contain', width: '32px', height: '32px' }} 
                  />
                ) : (
                  <div className="logo-fallback-icon" style={{
                    width: '36px', height: '36px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--primary)', borderRadius: '8px',
                    color: '#fff', fontWeight: '900', fontSize: '12px',
                    letterSpacing: '0.5px', flexShrink: 0,
                  }}>
                    OAE
                  </div>
                )}
              </>
            ) : (
              <>
                {!logoError ? (
                  <div className="sidebar-logo-lockup">
                    <img src="/logo.png" alt="" onError={() => setLogoError(true)} />
                    <span><strong>OLIVEIRA ARAÚJO</strong><small>ENGENHARIA</small></span>
                  </div>
                ) : (
                  <div className="logo-fallback-full" style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
                    gap: '0.5rem',
                    height: '36px',
                    color: 'var(--text-main)',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: '36px', height: '36px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'var(--primary)', borderRadius: '8px',
                      color: '#fff', fontWeight: '900', fontSize: '12px', flexShrink: 0
                    }}>
                      OAE
                    </div>
                    <span style={{ fontSize: '15px', fontWeight: '700', letterSpacing: '-0.5px', whiteSpace: 'nowrap' }}>Oliveira Araújo</span>
                  </div>
                )}
              </>
            )}
          </div>
          
          <button 
            onClick={handleToggle}
            style={{
              position: (collapsed && !isMobile) ? 'absolute' : 'static',
              right: (collapsed && !isMobile) ? '-12px' : 'auto',
              background: (collapsed && !isMobile) ? 'var(--bg-elevated)' : 'transparent',
              border: (collapsed && !isMobile) ? '1px solid var(--border-color)' : 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.35rem',
              display: isMobile ? 'none' : 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: (collapsed && !isMobile) ? '50%' : '6px',
              transition: 'all 0.2s ease',
              zIndex: 10
            }}
            title={(collapsed && !isMobile) ? "Expandir Menu" : "Recolher Menu"}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = (collapsed && !isMobile) ? 'var(--primary)' : 'rgba(255,255,255,0.05)';
              e.currentTarget.style.color = (collapsed && !isMobile) ? '#fff' : 'var(--text-secondary)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = (collapsed && !isMobile) ? 'var(--bg-elevated)' : 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            {(collapsed && !isMobile) ? <ChevronRight size={14} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '0.75rem 0.5rem', overflowY: 'auto', overflowX: 'hidden' }}>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
            {menuItems.map((item) => {
              const visibleChildren = (item.children || []).filter((child) => canAccess(child.permission));
              const isGroup = visibleChildren.length > 0;
              const isAdministrativeGroup = item.path === '/administrativo';
              const showGroupChildren = isAdministrativeGroup ? showAdministrativeChildren : showSettingsChildren;
              const isActive = pathname === item.path || visibleChildren.some((child) => pathname === child.path);
              const Icon = item.icon;
              const MenuLink = isAdministrativeGroup ? 'button' : Link;
              return (
                <li key={item.name}>
                  <MenuLink
                    className={`sidebar-nav-link${isActive ? ' is-active' : ''}`}
                    {...(isAdministrativeGroup
                      ? { type: 'button', 'aria-expanded': showGroupChildren, 'aria-controls': 'sidebar-administrativo-submenu' }
                      : { href: item.path })}
                    onClick={() => {
                      if (isAdministrativeGroup) {
                        if (collapsed && !isMobile) {
                          setCollapsed(false);
                          localStorage.setItem('sidebar_collapsed', 'false');
                          setAdministrativeOpen(true);
                        } else {
                          setAdministrativeOpen((open) => !(open ?? isAdministrativePath));
                        }
                      } else {
                        if (isGroup) setSettingsOpen(true);
                        if (isMobile) setCollapsed(true);
                      }
                    }}
                    style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.5rem',
                    color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                    textDecoration: 'none',
                    backgroundColor: isActive ? 'rgba(57, 198, 198, 0.1)' : 'transparent',
                    borderRadius: '6px',
                    border: 'none',
                    width: isAdministrativeGroup ? '100%' : undefined,
                    font: 'inherit',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'background-color 0.12s ease',
                    justifyContent: (collapsed && !isMobile) ? 'center' : 'flex-start',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden'
                  }}
                  title={(collapsed && !isMobile) ? item.name : ""}
                  onMouseOver={(e) => { if(!isActive) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)' }}
                  onMouseOut={(e) => { if(!isActive) e.currentTarget.style.backgroundColor = 'transparent' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '24px' }}>
                      <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                    </div>
                    {!(collapsed && !isMobile) && (
                      <>
                        <span style={{ fontSize: '14px', fontWeight: isActive ? '600' : '500', marginLeft: '0.6rem', flex: 1 }}>{item.name}</span>
                        {isGroup && (isAdministrativeGroup ? (
                          <ChevronDown size={14} aria-hidden="true" style={{ transform: showGroupChildren ? 'rotate(180deg)' : 'none' }} />
                        ) : (
                          <span role="button" tabIndex={0} aria-label={showGroupChildren ? 'Recolher submenu' : 'Expandir submenu'} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setSettingsOpen((open) => !open); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); setSettingsOpen((open) => !open); } }} style={{ display: 'flex', padding: '2px', color: 'inherit', cursor: 'pointer' }}>
                            <ChevronDown size={14} style={{ transform: showGroupChildren ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                          </span>
                        ))}
                      </>
                    )}
                  </MenuLink>
                  {isGroup && showGroupChildren && !(collapsed && !isMobile) && (
                    <ul id={isAdministrativeGroup ? 'sidebar-administrativo-submenu' : undefined} style={{ listStyle: 'none', margin: '0.2rem 0 0.3rem 1.15rem', paddingLeft: '0.65rem', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      {visibleChildren.map((child) => {
                        const ChildIcon = child.icon;
                        const childActive = pathname === child.path;
                        return (
                          <li key={child.path}>
                            <Link className={`sidebar-child-link${childActive ? ' is-active' : ''}`} href={child.path} prefetch={false} onClick={() => { if (isMobile) setCollapsed(true); }} style={{ display: 'flex', alignItems: 'center', gap: child.subtle ? '0.4rem' : '0.5rem', padding: child.subtle ? '0.38rem 0.5rem' : '0.45rem 0.55rem', borderRadius: '6px', textDecoration: 'none', color: childActive ? 'var(--primary)' : 'var(--text-secondary)', background: childActive ? (child.subtle ? 'rgba(57,198,198,0.05)' : 'rgba(57,198,198,0.09)') : 'transparent', fontSize: child.subtle ? '11px' : '12px', fontWeight: childActive ? (child.subtle ? '600' : '700') : '500', lineHeight: 1.25, opacity: child.subtle && !childActive ? 0.86 : 1 }}>
                              <ChildIcon size={child.subtle ? 13 : 14} style={{ flexShrink: 0 }} /> <span style={{ whiteSpace: 'normal' }}>{child.name}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Logout */}
        {canPreview && <DesignPreviewToggle active={previewActive} collapsed={collapsed && !isMobile} />}
        <div style={{ padding: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
          <form action="/api/auth/logout" method="POST">
            <button 
              type="submit" 
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: (collapsed && !isMobile) ? 'center' : 'flex-start',
                padding: '0.5rem',
                backgroundColor: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                borderRadius: '6px',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap',
                overflow: 'hidden'
              }}
              title={(collapsed && !isMobile) ? "Logout" : ""}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                e.currentTarget.style.color = 'var(--danger)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '24px' }}>
                <LogOut size={18} strokeWidth={2} />
              </div>
              {!(collapsed && !isMobile) && <span style={{ fontSize: '14px', fontWeight: '500', marginLeft: '0.6rem' }}>Logout</span>}
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
