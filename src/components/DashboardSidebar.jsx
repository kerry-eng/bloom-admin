import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function DashboardSidebar({ isMobileMenuOpen, setIsMobileMenuOpen, activeView, setActiveView }) {
    const { isSuperAdmin, signOut } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const handleNavClick = (view) => {
        if (view === 'mentors') {
            navigate('/mentors');
        } else if (view === 'overview' || view === 'schedule' || view === 'earnings' || view === 'settings' || view === 'messages') {
            navigate('/');
            if (setActiveView) setActiveView(view);
        } else if (setActiveView) {
            setActiveView(view);
        }
        if (setIsMobileMenuOpen) setIsMobileMenuOpen(false);
    };

    return (
        <aside className={`workspace-sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
            <div className="sidebar-brand">
                <Link to="/" className="brand-logo" onClick={() => setIsMobileMenuOpen(false)}>
                    <img src="/LOGO.png" alt="Bloom Logo" style={{ height: '45px', width: 'auto', marginRight: '8px' }} />
                    <span className="logo-text" style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>Admin</span>
                </Link>
            </div>
            
            <nav className="sidebar-nav">
                <div className="nav-group">
                    <button 
                        className={`nav-item-arch ${activeView === 'overview' && location.pathname === '/' ? 'active' : ''}`} 
                        onClick={() => handleNavClick('overview')}
                    >
                        {isSuperAdmin ? 'PLATFORM OVERVIEW' : 'OVERVIEW'}
                    </button>
                    {isSuperAdmin && (
                        <button 
                            className={`nav-item-arch ${location.pathname === '/mentors' ? 'active' : ''}`} 
                            onClick={() => handleNavClick('mentors')}
                        >
                            DIRECTORY
                        </button>
                    )}
                    {!isSuperAdmin && (
                        <>
                            <button className={`nav-item-arch ${activeView === 'schedule' ? 'active' : ''}`} onClick={() => handleNavClick('schedule')}>MY SCHEDULE</button>
                            <button className={`nav-item-arch ${activeView === 'earnings' ? 'active' : ''}`} onClick={() => handleNavClick('earnings')}>MY EARNINGS</button>
                            <button className={`nav-item-arch ${activeView === 'messages' ? 'active' : ''}`} onClick={() => handleNavClick('messages')}>MESSAGES</button>
                        </>
                    )}
                    <button className={`nav-item-arch ${activeView === 'settings' ? 'active' : ''}`} onClick={() => handleNavClick('settings')}>SETTINGS</button>
                </div>
            </nav>

            <div className="sidebar-footer">
                <button className="nav-item-arch" onClick={signOut}>SIGN OUT</button>
            </div>
        </aside>
    );
}
