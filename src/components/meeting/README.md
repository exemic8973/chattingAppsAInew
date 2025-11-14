# Teams-Style Meeting UI Components

This directory contains modular components for creating a Microsoft Teams-style meeting interface.

## Components Overview

### 1. MeetingHeader
Top header bar with meeting information and controls.

**Props:**
- `roomId: string` - The meeting room ID
- `participantCount: number` - Number of participants
- `onLeave?: () => void` - Callback when leave button is clicked

**Features:**
- Meeting room ID display
- Participant count
- Elapsed time counter
- Copy meeting link button
- Leave meeting button

### 2. VideoTile
Individual video tile for displaying participant video or avatar.

**Props:**
- `stream?: MediaStream | null` - Media stream to display
- `userName: string` - Participant's display name
- `isLocal?: boolean` - Whether this is the local user
- `isMuted?: boolean` - Microphone mute status
- `isVideoOff?: boolean` - Camera status
- `isSpeaking?: boolean` - Whether participant is speaking
- `isHost?: boolean` - Whether participant is the host

**Features:**
- Video display with fallback to avatar
- Microphone mute indicator
- Speaking indicator (blue border)
- Host badge (gold border)
- Local video mirroring
- Responsive sizing

### 3. VideoGallery
Grid layout container for all video tiles.

**Props:**
- `localStream?: MediaStream | null` - Local user's media stream
- `localUserName: string` - Local user's name
- `localIsMuted: boolean` - Local mic status
- `localIsVideoOff: boolean` - Local camera status
- `localIsSpeaking: boolean` - Local speaking status
- `participants: Participant[]` - Array of remote participants
- `remoteStreams: Map<string, { stream: MediaStream }>` - Remote streams
- `isHost: boolean` - Whether local user is host

**Features:**
- Automatic grid layout based on participant count:
  - 1 participant: Full screen
  - 2 participants: Side by side
  - 3-4 participants: 2x2 grid
  - 5-9 participants: 3x3 grid
  - 10+ participants: Responsive grid
- Responsive design
- Smooth transitions

### 4. MeetingControls
Bottom control bar with meeting action buttons.

**Props:**
- `isMuted: boolean` - Microphone status
- `isVideoOff: boolean` - Camera status
- `onToggleMute: () => void` - Mute/unmute callback
- `onToggleVideo: () => void` - Camera on/off callback
- `onToggleChat: () => void` - Show/hide chat
- `onToggleParticipants: () => void` - Show/hide participants
- `onLeaveMeeting: () => void` - Leave meeting callback
- `onShareScreen?: () => void` - (Optional) Share screen callback
- `showMoreOptions?: boolean` - Show more options button

**Features:**
- Microphone control
- Camera control
- Screen share button (optional)
- Chat toggle
- Participants toggle
- More options menu
- Leave meeting button (red)
- Labeled buttons with icons
- Hover effects

### 5. SidePanel
Collapsible sidebar with Chat and Participants tabs.

**Props:**
- `messages: Message[]` - Array of chat messages
- `participants: User[]` - Array of participants
- `currentUserName: string` - Current user's name
- `currentUserId: string` - Current user's ID
- `isHost: boolean` - Whether current user is host
- `newMessage: string` - New message input value
- `onMessageChange: (message: string) => void` - Message input callback
- `onSendMessage: () => void` - Send message callback
- `onClose?: () => void` - Close panel callback

**Features:**
- Tabbed interface (Chat / People)
- Chat with message history
- Message input with send button
- Participants list with avatars
- Host badge display
- Auto-scroll to new messages
- Responsive design

## Usage Example

```tsx
import MeetingHeader from '@/components/meeting/MeetingHeader';
import VideoGallery from '@/components/meeting/VideoGallery';
import MeetingControls from '@/components/meeting/MeetingControls';
import SidePanel from '@/components/meeting/SidePanel';

export default function MyMeetingRoom() {
  // Your state management...
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [showSidePanel, setShowSidePanel] = useState(true);

  return (
    <div className="teams-meeting-container">
      {/* Header */}
      <MeetingHeader
        roomId={roomId}
        participantCount={1 + participants.length}
        onLeave={() => router.push('/')}
      />

      {/* Main Content */}
      <div className="meeting-content">
        {/* Video Gallery */}
        <VideoGallery
          localStream={localStream}
          localUserName={userName}
          localIsMuted={isMuted}
          localIsVideoOff={isVideoOff}
          localIsSpeaking={isSpeaking}
          participants={participants}
          remoteStreams={remoteStreams}
          isHost={isOwner}
        />

        {/* Side Panel (conditional) */}
        {showSidePanel && (
          <SidePanel
            messages={messages}
            participants={participants}
            currentUserName={userName}
            currentUserId={currentUserId}
            isHost={isOwner}
            newMessage={newMessage}
            onMessageChange={setNewMessage}
            onSendMessage={sendMessage}
            onClose={() => setShowSidePanel(false)}
          />
        )}
      </div>

      {/* Bottom Controls */}
      <MeetingControls
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        onToggleMute={() => setIsMuted(!isMuted)}
        onToggleVideo={() => setIsVideoOff(!isVideoOff)}
        onToggleChat={() => setShowSidePanel(!showSidePanel)}
        onToggleParticipants={() => setShowSidePanel(!showSidePanel)}
        onLeaveMeeting={() => router.push('/')}
        showMoreOptions={true}
      />
    </div>
  );
}
```

## Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ MeetingHeader (60px)                                        │
│  Room ID | Participants | Time    [ Copy Link ] [ Leave ]  │
├─────────────────────────────────────────┬───────────────────┤
│                                         │                   │
│                                         │   SidePanel       │
│                                         │   (360px)         │
│         VideoGallery                    │                   │
│         (Flex-grow)                     │  ┌─────┬──────┐  │
│                                         │  │Chat │People│  │
│  ┌──────────┬──────────┬──────────┐    │  ├─────────────┤  │
│  │          │          │          │    │  │             │  │
│  │ Video 1  │ Video 2  │ Video 3  │    │  │  Messages   │  │
│  │          │          │          │    │  │     or      │  │
│  ├──────────┼──────────┼──────────┤    │  │Participants │  │
│  │          │          │          │    │  │             │  │
│  │ Video 4  │ Video 5  │ Video 6  │    │  │             │  │
│  │          │          │          │    │  └─────────────┘  │
│  └──────────┴──────────┴──────────┘    │                   │
│                                         │                   │
├─────────────────────────────────────────┴───────────────────┤
│ MeetingControls (80px)                                      │
│     [🎤] [📹] [📺] [💬] [👥] [...] [📞Leave]              │
└─────────────────────────────────────────────────────────────┘
```

## Styling

All components use the global CSS classes defined in `/src/app/globals.css`:

- `.teams-meeting-container` - Main container
- `.meeting-header` - Header styling
- `.meeting-content` - Content area
- `.video-gallery` - Gallery grid
- `.video-gallery-single/dual/quad/nine/many` - Grid layouts
- `.video-tile` - Individual tile styling
- `.meeting-controls` - Control bar
- `.control-btn` - Control buttons
- `.side-panel` - Side panel

## Responsive Behavior

- **Mobile (< 768px):**
  - Side panel becomes overlay
  - Video grid switches to 2 columns
  - Control labels hidden
  - Buttons smaller

- **Small Mobile (< 480px):**
  - Video grid becomes single column
  - Reduced text sizes

## Color Scheme (Teams-like)

- Background: `#252525`
- Cards: `#1f1f1f`, `#1a1a1a`
- Borders: `#3a3a3a`
- Primary (Blue): `#0078d4`
- Danger (Red): `#e81123`
- Host (Gold): `#ffd700`
- Controls: `#424242`

## Next Steps

To integrate these components into your existing ChatRoom:

1. Import the components
2. Replace old layout with new Teams-style layout
3. Connect your existing state management
4. Test responsive behavior
5. Add any custom features (screen share, reactions, etc.)
