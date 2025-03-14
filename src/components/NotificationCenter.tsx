import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Campaign, CampaignApartment, Apartment } from '../types';
import { Bell, X, AlertTriangle, AlertCircle } from 'lucide-react';
import { format, addMonths, parseISO, isBefore } from 'date-fns';
import toast from 'react-hot-toast';

interface Notification {
  id: string;
  type: 'warning' | 'info';
  title: string;
  message: string;
  campaign: Campaign;
  timestamp: Date;
}

interface NotificationCenterProps {
  isAdmin: boolean;
  campaigns: Campaign[];
  campaignApartments: CampaignApartment[];
  apartments: Apartment[];
}

const NotificationCenter = ({ isAdmin, campaigns, campaignApartments, apartments }: NotificationCenterProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    checkCampaigns();
  }, [campaigns, campaignApartments, apartments]);

  const checkCampaigns = () => {
    const newNotifications: Notification[] = [];
    const now = new Date();

    campaigns.forEach(campaign => {
      // Check for ending campaigns (within 7 days)
      if (campaign.campaign_end_date) {
        const endDate = parseISO(campaign.campaign_end_date);
        const sevenDaysFromNow = addMonths(now, 1);
        
        if (isBefore(endDate, sevenDaysFromNow) && campaign.active) {
          newNotifications.push({
            id: `end-${campaign.id}`,
            type: 'warning',
            title: 'Campaign Ending Soon',
            message: `Campaign ${campaign.id} will end on ${format(endDate, 'MM/yyyy')}`,
            campaign,
            timestamp: now
          });
        }
      }

      // Check for sold apartments
      const campaignApts = campaignApartments.filter(ca => ca.campaign_id === campaign.id);
      const availableApts = new Set(apartments.map(apt => apt.key));
      
      const soldApts = campaignApts.filter(ca => !availableApts.has(ca.apartment_key));
      
      if (soldApts.length > 0 && campaign.active) {
        newNotifications.push({
          id: `sold-${campaign.id}`,
          type: 'info',
          title: 'Apartments No Longer Available',
          message: `${soldApts.length} apartment(s) in campaign ${campaign.id} are no longer available`,
          campaign,
          timestamp: now
        });
      }
    });

    setNotifications(prev => {
      const existingIds = new Set(prev.map(n => n.id));
      const newNotifs = newNotifications.filter(n => !existingIds.has(n.id));
      return [...newNotifs, ...prev].slice(0, 50); // Keep last 50 notifications
    });

    setUnreadCount(prev => prev + newNotifications.length);
  };

  const handleDismiss = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleClearAll = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  return (
    <div className="relative">
      {/* Notification Bell */}
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="relative p-2 text-gray-500 hover:text-gray-700 focus:outline-none transition-colors rounded-lg hover:bg-gray-100"
      >
        <Bell size={22} className={unreadCount > 0 ? 'animate-pulse' : ''} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {showNotifications && (
        <div className="absolute right-0 top-full mt-2 w-[420px] bg-white rounded-xl shadow-xl z-50 max-h-[80vh] overflow-hidden border border-gray-100">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-gray-500" />
                <h3 className="text-base font-semibold text-gray-800">Notifications</h3>
              </div>
              <button
                onClick={handleClearAll}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Clear all
              </button>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[calc(80vh-4rem)] divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-500 bg-gray-50/50">
                No notifications
              </div>
            ) : (
              <div>
                {notifications.map((notification) => (
                  <div key={notification.id} className="p-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          {notification.type === 'warning' ? (
                            <div className="p-2 bg-amber-50 rounded-lg">
                              <AlertTriangle className="h-5 w-5 text-amber-500" />
                            </div>
                          ) : (
                            <div className="p-2 bg-blue-50 rounded-lg">
                              <AlertCircle className="h-5 w-5 text-blue-500" />
                            </div>
                          )}
                        </div>
                        <div className="ml-3 flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">
                            {notification.title}
                          </p>
                          <p className="mt-1 text-sm text-gray-500">
                            {notification.message}
                          </p>
                          <p className="mt-2 text-xs text-gray-400 font-medium">
                            {format(notification.timestamp, 'MMM d, yyyy HH:mm')}
                          </p>
                        </div>
                      </div>
                      <div className="ml-4 flex-shrink-0 flex">
                        <button
                          onClick={() => handleDismiss(notification.id)}
                          className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          <span className="sr-only">Close</span>
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;