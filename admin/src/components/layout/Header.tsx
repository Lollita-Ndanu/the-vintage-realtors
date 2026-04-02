import { BellIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const { user } = useAuth();

  const getUserInitials = () => {
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return 'A';
  };

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200 safe-area-top">
      <div className="flex items-center justify-between px-4 py-3 lg:px-6">
        <div className="flex items-center">
          <div className="lg:hidden w-8" />
          <h1 className="text-lg lg:text-xl font-bold text-brand-dark ml-12 lg:ml-0">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-2 lg:gap-4">
          <button className="btn-icon relative">
            <BellIcon className="h-5 w-5 text-gray-500" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-status-error rounded-full" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-brand-purple flex items-center justify-center">
              <span className="text-white text-sm font-semibold">{getUserInitials()}</span>
            </div>
            <div className="hidden lg:block">
              <p className="text-sm font-medium text-brand-dark">Admin</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
