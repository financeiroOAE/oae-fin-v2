"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  Menu
} from 'lucide-react';

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [iconError, setIconError] = useState(false);
  const [sessionUser, setSessionUser] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
    if (pathname === '/') {
      setCollapsed(true);
    } else if (!isMobile) {
      const savedState = localStorage.getItem('sidebar_collapsed');
      if (savedState !== null) {
        setCollapsed(JSON.parse(savedState));
      }
    }
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

  const canAccess = (permission) => !sessionUser || sessionUser.role === 'ADMIN' || sessionUser.permissions?.includes(permission);
  const isSettingsPath = ['/configuracoes', '/atualizacao-dados', '/historico'].some((path) => pathname.startsWith(path));
  const showSettingsChildren = settingsOpen || isSettingsPath;
  const menuItems = [
    { name: 'Início', path: '/', icon: LayoutDashboard, permission: 'inicio' },
    { name: 'Visão Financeira', path: '/visao-financeira', icon: BarChart3, permission: 'visao_financeira' },
    { name: 'Fluxo de Caixa', path: '/fluxo-caixa', icon: Activity, permission: 'fluxo_caixa' },
    { name: 'Projetos', path: '/projetos', icon: FolderKanban, permission: 'projetos' },
    { name: 'DRE Gerencial', path: '/dre', icon: ChartColumn, permission: 'dre' },
    {
      name: 'Configurações', path: '/configuracoes', icon: Settings, permission: 'configuracoes',
      children: [
        { name: 'Atualização de Dados', path: '/atualizacao-dados', icon: RefreshCw, permission: 'atualizacao_dados' },
        { name: 'Histórico', path: '/historico', icon: History, permission: 'historico' },
      ],
    },
  ].filter((item) => canAccess(item.permission) || item.children?.some((child) => canAccess(child.permission)));

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
        <div onClick={() => setCollapsed(true)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 95, backdropFilter: 'blur(2px)' }} />
      )}
      
      <aside style={{
        width: collapsed && !isMobile ? '72px' : '240px',
        minWidth: collapsed && !isMobile ? '72px' : '240px',
        maxWidth: collapsed && !isMobile ? '72px' : '240px',
        flexShrink: 0,
        backgroundColor: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-color)',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s ease',
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
        <div style={{
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
                  <img src="/logo.png" alt="OAE" className="sidebar-logo" 
                    onError={() => setLogoError(true)}
                    style={{ objectFit: 'contain', maxHeight: '40px', maxWidth: '160px' }} 
                  />
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
              const isSettingsGroup = visibleChildren.length > 0;
              const isActive = pathname === item.path || visibleChildren.some((child) => pathname === child.path);
              const Icon = item.icon;
              return (
                <li key={item.name}>
                  <Link href={item.path} onClick={() => { if (isSettingsGroup) setSettingsOpen(true); if(isMobile) setCollapsed(true); }} style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.5rem',
                    color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                    textDecoration: 'none',
                    backgroundColor: isActive ? 'rgba(57, 198, 198, 0.1)' : 'transparent',
                    borderRadius: '6px',
                    transition: 'all 0.2s ease',
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
                        {isSettingsGroup && (
                          <span role="button" tabIndex={0} aria-label={settingsOpen ? 'Recolher configurações' : 'Expandir configurações'} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setSettingsOpen((open) => !open); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); setSettingsOpen((open) => !open); } }} style={{ display: 'flex', padding: '2px', color: 'inherit', cursor: 'pointer' }}>
                            <ChevronDown size={14} style={{ transform: showSettingsChildren ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                  {isSettingsGroup && showSettingsChildren && !(collapsed && !isMobile) && (
                    <ul style={{ listStyle: 'none', margin: '0.2rem 0 0.3rem 1.15rem', paddingLeft: '0.65rem', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      {visibleChildren.map((child) => {
                        const ChildIcon = child.icon;
                        const childActive = pathname === child.path;
                        return (
                          <li key={child.path}>
                            <Link href={child.path} onClick={() => { if (isMobile) setCollapsed(true); }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.55rem', borderRadius: '6px', textDecoration: 'none', color: childActive ? 'var(--primary)' : 'var(--text-secondary)', background: childActive ? 'rgba(57,198,198,0.09)' : 'transparent', fontSize: '12px', fontWeight: childActive ? '700' : '500', lineHeight: 1.25 }}>
                              <ChildIcon size={14} style={{ flexShrink: 0 }} /> <span style={{ whiteSpace: 'normal' }}>{child.name}</span>
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
