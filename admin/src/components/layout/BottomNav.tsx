import { NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import {
  HomeIcon,
  EnvelopeIcon,
  InboxIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
  Bars3Icon,
  XMarkIcon,
  NewspaperIcon,
  UsersIcon,
  ChatBubbleLeftRightIcon,
  TagIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';

const primaryNavItems = [
  { name: 'Home', href: '/dashboard', icon: HomeIcon },
  { name: 'Inbox', href: '/inbox', icon: InboxIcon },
  { name: 'Contacts', href: '/contacts', icon: EnvelopeIcon },
  { name: 'Properties', href: '/properties', icon: BuildingOfficeIcon },
  { name: 'Content', href: '/content', icon: DocumentTextIcon },
];

const moreNavItems = [
  { name: 'Newsletter', href: '/newsletter', icon: NewspaperIcon },
  { name: 'Agents', href: '/agents', icon: UsersIcon },
  { name: 'Testimonials', href: '/testimonials', icon: ChatBubbleLeftRightIcon },
  { name: 'Leads', href: '/leads', icon: TagIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
];

export default function BottomNav() {
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);

  const isMoreActive = moreNavItems.some(item => location.pathname === item.href);

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setShowMore(false)}
        />
      )}

      {/* More menu panel */}
      <div
        className={`
          fixed bottom-16 left-4 right-4 z-50 bg-white rounded-2xl shadow-xl border border-gray-200
          transform transition-all duration-300 ease-out
          ${showMore ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}
        `}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-brand-dark">More Options</h3>
            <button
              onClick={() => setShowMore(false)}
              className="p-1 rounded-lg hover:bg-gray-100"
            >
              <XMarkIcon className="h-5 w-5 text-gray-500" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {moreNavItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={() => setShowMore(false)}
                className={`
                  flex flex-col items-center justify-center p-3 rounded-xl transition-colors
                  ${location.pathname === item.href
                    ? 'bg-brand-purple/10 text-brand-purple'
                    : 'text-gray-600 hover:bg-gray-100'
                  }
                `}
              >
                <item.icon className="h-6 w-6 mb-1" />
                <span className="text-xs font-medium">{item.name}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom navigation bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 safe-area-bottom">
        <div className="flex items-center justify-around px-2 py-1">
          {primaryNavItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={`
                  flex flex-col items-center justify-center min-h-touch min-w-touch rounded-xl transition-colors
                  ${isActive ? 'text-brand-purple' : 'text-gray-500'}
                `}
              >
                <item.icon className={`h-6 w-6 ${isActive ? 'stroke-2' : ''}`} />
                <span className={`text-xs mt-0.5 ${isActive ? 'font-semibold' : ''}`}>
                  {item.name}
                </span>
              </NavLink>
            );
          })}
          <button
            onClick={() => setShowMore(!showMore)}
            className={`
              flex flex-col items-center justify-center min-h-touch min-w-touch rounded-xl transition-colors
              ${isMoreActive ? 'text-brand-purple' : 'text-gray-500'}
            `}
          >
            <Bars3Icon className={`h-6 w-6 ${isMoreActive ? 'stroke-2' : ''}`} />
            <span className={`text-xs mt-0.5 ${isMoreActive ? 'font-semibold' : ''}`}>
              More
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
