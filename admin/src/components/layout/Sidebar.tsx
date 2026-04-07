import { NavLink, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  EnvelopeIcon,
  InboxIcon,
  NewspaperIcon,
  BuildingOfficeIcon,
  UsersIcon,
  ChatBubbleLeftRightIcon,
  TagIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';
import { useState } from 'react';

const navItems = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Contacts', href: '/contacts', icon: EnvelopeIcon },
  { name: 'Inbox', href: '/inbox', icon: InboxIcon },
  { name: 'Newsletter', href: '/newsletter', icon: NewspaperIcon },
  { name: 'Properties', href: '/properties', icon: BuildingOfficeIcon },
  { name: 'Agents', href: '/agents', icon: UsersIcon },
  { name: 'Testimonials', href: '/testimonials', icon: ChatBubbleLeftRightIcon },
  { name: 'Leads', href: '/leads', icon: TagIcon },
  { name: 'Page Content', href: '/content', icon: DocumentTextIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
];

const mobileNavItems = [
  { name: 'Home', href: '/dashboard', icon: HomeIcon },
  { name: 'Contacts', href: '/contacts', icon: EnvelopeIcon },
  { name: 'Inbox', href: '/inbox', icon: InboxIcon },
  { name: 'Properties', href: '/properties', icon: BuildingOfficeIcon },
  { name: 'Content', href: '/content', icon: DocumentTextIcon },
  { name: 'More', href: '#more', icon: Bars3Icon, isMore: true },
];

export default function Sidebar() {
  const { signOut } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
  };

  const NavContent = () => (
    <>
      <div className="flex flex-col flex-1 overflow-y-auto pt-5 pb-4">
        <div className="flex items-center flex-shrink-0 px-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-purple flex items-center justify-center">
              <span className="text-white font-bold text-lg">V</span>
            </div>
            <div className="hidden lg:block">
              <h1 className="text-lg font-bold text-brand-dark">Vintage</h1>
              <p className="text-xs text-gray-500">Admin Panel</p>
            </div>
          </div>
        </div>

        <nav className="mt-2 flex-1 px-2 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={() => setIsOpen(false)}
                className={`
                  group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
                  ${isActive
                    ? 'bg-brand-purple text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-brand-dark'
                  }
                `}
              >
                <item.icon
                  className={`mr-3 h-5 w-5 flex-shrink-0 ${
                    isActive ? 'text-white' : 'text-gray-400 group-hover:text-brand-purple'
                  }`}
                />
                <span className="hidden lg:block">{item.name}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
        <button
          onClick={handleSignOut}
          className="flex items-center w-full px-3 py-2.5 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-100 hover:text-brand-dark transition-colors"
        >
          <ArrowRightOnRectangleIcon className="mr-3 h-5 w-5 text-gray-400" />
          <span className="hidden lg:block">Sign out</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-30 p-2 rounded-lg bg-white shadow-md"
      >
        <Bars3Icon className="h-6 w-6 text-brand-dark" />
      </button>

      {/* Mobile drawer overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 bg-white border-r border-gray-200">
        <NavContent />
      </div>

      {/* Mobile drawer */}
      <div
        className={`
          lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-white transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="absolute top-4 right-4">
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <XMarkIcon className="h-6 w-6 text-gray-500" />
          </button>
        </div>
        <NavContent />
      </div>
    </>
  );
}

export { mobileNavItems };
