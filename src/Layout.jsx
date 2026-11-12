import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import Modal from './components/Modal';

const NAV = [
  {
    title: 'تمرین',
    items: [
      { to: '/train', label: 'تمرین امروز' },
      { to: '/programs', label: 'برنامه‌ها' },
      { to: '/history', label: 'تاریخچه تمرین' },
      { to: '/exercises', label: 'حرکت‌ها' },
      { to: '/muscles', label: 'عضله‌ها' },
    ],
  },
  {
    title: 'تغذیه',
    items: [
      { to: '/nutrition', label: 'تغذیه امروز', end: true },
      { to: '/foods', label: 'غذاها' },
      { to: '/nutrition/goals', label: 'هدف تغذیه' },
      { to: '/nutrition/history', label: 'تاریخچه تغذیه' },
    ],
  },
  {
    title: 'بدن',
    items: [
      { to: '/body-weight', label: 'وزن بدن' },
      { to: '/profile', label: 'پروفایل' },
      { to: '/settings', label: 'تنظیمات و پشتیبان' },
    ],
  },
];

// Phone bottom bar: the four things used daily + a "more" sheet with everything else.
const TABS = [
  { label: 'تمرین', icon: '🏋️', match: ['/train', '/programs', '/history', '/exercises', '/muscles'], to: '/train' },
  { label: 'تغذیه', icon: '🍽️', match: ['/nutrition'], to: '/nutrition' },
  { label: 'غذاها', icon: '🥑', match: ['/foods'], to: '/foods' },
  { label: 'وزن', icon: '⚖️', match: ['/body-weight', '/profile'], to: '/body-weight' },
];

const isIn = (pathname, prefixes) => prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

function BottomNav() {
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav className="bottom-nav" aria-label="ناوبری اصلی">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} className={isIn(pathname, t.match) ? 'active' : ''}>
            <span className="tab-icon" aria-hidden="true">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
        <button type="button" className={moreOpen ? 'active' : ''} onClick={() => setMoreOpen(true)}>
          <span className="tab-icon" aria-hidden="true">☰</span>
          بیشتر
        </button>
      </nav>

      {moreOpen && (
        <Modal title="همه‌ی بخش‌ها" onClose={() => setMoreOpen(false)}>
          <div className="more-sheet">
            {NAV.map((group) => (
              <div className="more-sheet-group" key={group.title}>
                <h3>{group.title}</h3>
                {group.items.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMoreOpen(false)} className={({ isActive }) => (isActive ? 'active' : '')}>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}

export default function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" />
          <span className="brand-name">Gymora</span>
        </div>
        <ul className="nav-list">
          {NAV.map((group) => [
            <li key={group.title} className="nav-group-title" aria-hidden="true">
              {group.title}
            </li>,
            ...group.items.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                  {item.label}
                </NavLink>
              </li>
            )),
          ])}
        </ul>
      </aside>
      <main className="main">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
