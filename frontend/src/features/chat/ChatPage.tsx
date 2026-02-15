import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ChatShell } from './components/ChatShell';
import { ChatSidebar } from './components/ChatSidebar/ChatSidebar';
import { ChatArea } from './components/ChatArea/ChatArea';
import { RightPanel } from './components/RightPanel';
import { useChatManager } from './hooks/useChatManager';
import { useWSEventBus } from './hooks/useWSEventBus';
import { FindPeopleModal } from '../../components/FindPeopleModal';
import { UserProfileModal } from '../../components/UserProfileModal';
import type { User } from '../../types';

export const ChatPage: React.FC = () => {
  const { user } = useAuth();
  // Mount WSEventBus — routes WS events to Zustand stores & query cache
  useWSEventBus();
  const {
    users,
    rooms,
    messages,
    active,
    unreadCounts,
    lastPreviews,
    isConnected,
    onlineUsers,
    isUsersLoading,
    isRoomsLoading,
    isHistoryLoading,
    isLoadingMore,
    hasMore,
    selectTarget,
    loadMoreMessages,
    sendMessage,
    currentUserId,
    send,
  } = useChatManager();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [isFindPeopleOpen, setIsFindPeopleOpen] = useState(false);
  const [profileUser, setProfileUser] = useState<User | null>(null);

  if (!user) return null;

  const handleSend = async (text: string, file: File | null, replyToId: number | null, messageType?: 'text' | 'image' | 'audio') => {
    await sendMessage(text, file, replyToId, null, messageType);
  };

  const handleTyping = (text: string) => {
    if (!active) return;
    if (active.type === 'dm') {
      if (text.trim().length > 0) {
        send('typing.start', { receiver_id: active.user.id });
      } else {
        send('typing.stop', { receiver_id: active.user.id });
      }
    }
  };

  const handleStartDM = (targetUser: User) => {
    selectTarget({ type: 'dm', user: targetUser });
    setIsSidebarOpen(false);
  };

  const meDisplayName = user.display_name || user.full_name || user.email;

  return (
    <div className="h-screen bg-[#f0f2f5] dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100">
      <ChatShell
        isSidebarOpen={isSidebarOpen}
        onCloseSidebar={() => setIsSidebarOpen(false)}
        isRightPanelOpen={isRightPanelOpen}
        sidebar={
          <ChatSidebar
            users={users}
            rooms={rooms}
            unreadCounts={unreadCounts}
            active={active}
            selectTarget={selectTarget}
            onlineUsers={onlineUsers}
            lastPreviews={lastPreviews}
            isUsersLoading={isUsersLoading}
            isRoomsLoading={isRoomsLoading}
            currentUserId={currentUserId}
            isConnected={isConnected}
            onOpenCreateRoom={() => {}}
            onOpenFindPeople={() => setIsFindPeopleOpen(true)}
            userProfile={{
              name: meDisplayName,
              avatarUrl: user.avatar_url,
            }}
          />
        }
        main={
          <ChatArea
            active={active}
            messages={messages}
            currentUserId={currentUserId}
            onSend={handleSend}
            onTyping={handleTyping}
            isUploading={false}
            isLoadingHistory={isHistoryLoading}
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
            onLoadMore={loadMoreMessages}
            onMobileMenuOpen={() => setIsSidebarOpen(true)}
          />
        }
        right={
          active && isRightPanelOpen ? (
            <RightPanel
              active={active}
              me={{ ...user, full_name: meDisplayName }}
              meStatus={undefined}
              isConnected={isConnected}
              notificationPermission={'Notification' in window ? Notification.permission : 'default'}
              onEnableNotifications={() => {
                if ('Notification' in window && Notification.permission !== 'granted') {
                  Notification.requestPermission();
                }
              }}
              onClose={() => setIsRightPanelOpen(false)}
            />
          ) : undefined
        }
      />

      {isFindPeopleOpen && (
        <FindPeopleModal
          onClose={() => setIsFindPeopleOpen(false)}
          onStartDM={handleStartDM}
          currentUserId={currentUserId}
        />
      )}

      {profileUser && (
        <UserProfileModal
          user={profileUser}
          isMe={profileUser.id === currentUserId}
          onClose={() => setProfileUser(null)}
          onStartDM={handleStartDM}
        />
      )}
    </div>
  );
};
