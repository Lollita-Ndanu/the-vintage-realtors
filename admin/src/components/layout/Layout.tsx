import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';

const getPageTitle = () => {
  const path = window.location.pathname;
  const titles: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/contacts': 'Contact Requests',
    '/newsletter': 'Newsletter',
    '/properties': 'Properties',
    '/agents': 'Agents',
    '/testimonials': 'Testimonials',
    '/leads': 'Lead Management',
    '/content': 'Page Content',
    '/settings': 'Settings',
  };
  return titles[path] || 'Dashboard';
};

export default function Layout() {
  return (
    <div className="min-h-screen bg-surface-secondary">
      <Sidebar />
      
      <div className="lg:pl-64">
        <Header title={getPageTitle()} />
        
        <main className="pb-20 lg:pb-8">
          <div className="px-4 py-4 lg:px-6 lg:py-6">
            <Outlet />
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
