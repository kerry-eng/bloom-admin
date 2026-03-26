import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function DashboardSidebar({ isMobileMenuOpen, setIsMobileMenuOpen, activeView, setActiveView }) {
    const { isSuperAdmin, signOut } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const handleNavClick = (view) => {
        if (view === 'mentors') {
            navigate('/mentors');
        } else if (view === 'overview' || view === 'schedule' || view === 'earnings' || view === 'settings') {
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
                    <div className="logo-icon-arch">
                        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20 5C20 5 20 15 10 20C15 20 20 20 20 35C20 35 20 25 30 20C25 20 20 20 20 5Z" fill="#7c6d8a"/>
                            <circle cx="20" cy="12" r="3" fill="#e6e0eb"/>
                        </svg>
                    </div>
                    <span className="logo-text">Bloom Admin</span>
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
