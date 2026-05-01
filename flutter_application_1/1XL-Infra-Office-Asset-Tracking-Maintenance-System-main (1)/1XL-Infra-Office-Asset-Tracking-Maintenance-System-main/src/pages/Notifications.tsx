import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { PageHeader, StatusBadge } from '../components/ui';
import { formatDateTime } from '../utils/helpers';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';

export default function Notifications() {
  const data = useData();
  const { user } = useAuth();
  const [refresh, setRefresh] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const allNotifications = data.notifications.getAll()
    .filter(n => n.userId === user?.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const notifications = filter === 'unread' ? allNotifications.filter(n => !n.isRead) : allNotifications;
  const unreadCount = allNotifications.filter(n => !n.isRead).length;

  const markAsRead = async (id: string) => {
    await data.notifications.update(id, { isRead: true });
    setRefresh(r => r + 1);
  };

  const markAllAsRead = async () => {
    for (const n of allNotifications.filter(n => !n.isRead)) {
      await data.notifications.update(n.id, { isRead: true });
    }
    setRefresh(r => r + 1);
  };

  const deleteNotification = async (id: string) => {
    await data.notifications.remove(id);
    setRefresh(r => r + 1);
  };

  const getTypeIcon = (type: string) => {
    const colors: Record<string, string> = {
      maintenance: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
      repair: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
      allocation: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
      warranty: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
      stock: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
      procurement: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
      user: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
      asset: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
      system: 'bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-400',
    };
    return colors[type] || 'bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-400';
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader title="Notifications" subtitle={`${unreadCount} unread notifications`}
        action={
          unreadCount > 0 ? (
            <button onClick={markAllAsRead}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm">
              <CheckCheck className="w-4 h-4" /> Mark All as Read
            </button>
          ) : undefined
        }
      />

      <div className="flex gap-2 mb-4">
        <button onClick={() => setFilter('all')}
          className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${filter === 'all' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-zinc-700 hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 hover:border-gray-300 dark:hover:border-zinc-600'}`}>
          All ({allNotifications.length})
        </button>
        <button onClick={() => setFilter('unread')}
          className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${filter === 'unread' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-zinc-700 hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 hover:border-gray-300 dark:hover:border-zinc-600'}`}>
          Unread ({unreadCount})
        </button>
      </div>

      <div className="card card-gradient divide-y divide-gray-50 dark:divide-zinc-700/30">
        {notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No notifications</p>
          </div>
        ) : (
          notifications.map(n => (
            <div key={n.id} className={`flex items-start gap-4 p-4 hover:bg-emerald-50/40 dark:hover:bg-emerald-500/5 transition-colors ${!n.isRead ? 'bg-emerald-50/30 dark:bg-emerald-500/10' : ''}`}>
              <div className={`p-2 rounded-lg ${getTypeIcon(n.type)} flex-shrink-0 mt-0.5`}>
                <Bell className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={`text-sm ${!n.isRead ? 'font-semibold' : 'font-medium'} text-gray-900 dark:text-white`}>{n.title}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{n.message}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-gray-400 dark:text-gray-500">{formatDateTime(n.createdAt)}</span>
                      <StatusBadge status={n.priority} />
                      <span className={`px-2 py-0.5 rounded text-xs ${getTypeIcon(n.type)}`}>{n.type}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {!n.isRead && (
                      <button onClick={() => markAsRead(n.id)} className="p-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-600/20 rounded text-emerald-600" title="Mark as read">
                        <CheckCheck className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => deleteNotification(n.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-500/20 rounded text-red-400 dark:text-red-500" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
