import React, { useState, useEffect } from 'react';

export default function Navbar({ onQuickQuery, currentUser, onThemeToggle, isDarkMode }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState(3);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const quickQueries = [
    { label: 'Revenue by Type', query: 'Show total revenue by campaign type', icon: '📊' },
    { label: 'Revenue Over Time', query: 'Show revenue over time', icon: '📈' },
    { label: 'Top Campaigns', query: 'Show top revenue campaigns', icon: '🏆' },
    { label: 'Summary Stats', query: 'Show summary statistics', icon: '📋' },
  ];

  return (
    <nav className={`navbar ${isScrolled ? 'navbar-scrolled' : ''} ${isDarkMode ? 'navbar-dark' : ''}`}>
      <div className="navbar-container">
        {/* Logo Section */}
        <div className="navbar-logo-section">
          <div className="navbar-logo">
            <span className="logo-icon">📊</span>
            <span className="logo-text">Nyka BI</span>
            <div className="logo-pulse"></div>
          </div>
          <div className="navbar-status">
            <span className="status-dot"></span>
            <span className="status-text">Live</span>
          </div>
        </div>

        {/* Desktop Menu */}
        <div className="navbar-menu">
          <ul className="navbar-links">
            <li>
              <a href="/" className="nav-link active">
                <span className="link-icon">🏠</span>
                Dashboard
              </a>
            </li>
            <li>
              <a href="/analytics" className="nav-link">
                <span className="link-icon">📈</span>
                Analytics
              </a>
            </li>
            <li>
              <a href="/reports" className="nav-link">
                <span className="link-icon">📄</span>
                Reports
              </a>
            </li>
          </ul>

          {/* Quick Actions Dropdown */}
          <div className="navbar-dropdown">
            <button className="dropdown-trigger">
              <span className="trigger-icon">⚡</span>
              Quick Actions
              <span className="dropdown-arrow">▼</span>
            </button>
            <div className="dropdown-menu">
              {quickQueries.map((item, index) => (
                <button
                  key={index}
                  className="dropdown-item"
                  onClick={() => onQuickQuery && onQuickQuery(item.query)}
                >
                  <span className="item-icon">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Section */}
        <div className="navbar-right">
          {/* Theme Toggle */}
          <button
            className="theme-toggle"
            onClick={onThemeToggle}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>

          {/* Notifications */}
          <button className="notification-btn">
            <span className="notif-icon">🔔</span>
            {notifications > 0 && <span className="notif-badge">{notifications}</span>}
          </button>

          {/* User Profile */}
          <div className="user-profile">
            {currentUser ? (
              <div className="user-info">
                <div className="user-avatar">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <span className="user-name">{currentUser.name}</span>
              </div>
            ) : (
              <a href="/login" className="login-btn">
                <span className="login-icon">👤</span>
                Login
              </a>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="mobile-menu-toggle"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="mobile-menu">
          <ul className="mobile-links">
            <li><a href="/" className="mobile-link">🏠 Dashboard</a></li>
            <li><a href="/analytics" className="mobile-link">📈 Analytics</a></li>
            <li><a href="/reports" className="mobile-link">📄 Reports</a></li>
            <li className="mobile-divider"></li>
            {quickQueries.map((item, index) => (
              <li key={index}>
                <button
                  className="mobile-quick-action"
                  onClick={() => {
                    onQuickQuery && onQuickQuery(item.query);
                    setIsMenuOpen(false);
                  }}
                >
                  {item.icon} {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}
