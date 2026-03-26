import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function DashboardTopbar({ isMobileMenuOpen, setIsMobileMenuOpen, onProfileClick, setActiveView }) {
    const { user, profile } = useAuth();

    return (
        <header className="workspace-topbar-arch">
            <div className="topbar-left-arch">
                <div className="topbar-search-arch hide-mobile">
                    <span className="search-icon">🔍</span>
                    <input type="text" placeholder="Search for sessions, mentees..." />
                </div>
            </div>
            <div className="topbar-right-arch">
                <div className="action-items-arch">
                    <button className="topbar-btn-circle" title="Messages" onClick={() => setActiveView('messages')}>
                        <span className="action-icon">💬</span>
                        <span className="notification-dot"></span>
                    </button>
                    <button className="topbar-btn-circle" title="Notifications" onClick={() => setActiveView('notifications')}>
                        <span className="action-icon">🔔</span>
                        <span className="notification-dot"></span>
                    </button>
                </div>
                <div className="user-profile-arch" onClick={onProfileClick}>
                    <div className="avatar-circle">
                        {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : (user?.email?.charAt(0).toUpperCase() || 'M')}
                    </div>
                    <div className="user-info-arch hide-mobile">
                        <span className="user-name-arch">{profile?.full_name || 'Mentor Name'}</span>
                        <span className="user-role-arch">{profile?.role?.toUpperCase() || 'MENTOR'}</span>
                    </div>
                </div>
            </div>
        </header>
    );
}
