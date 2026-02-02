import { useEffect, useRef } from 'react';
import { PhoneOff, Video, VideoOff, Mic, MicOff } from 'lucide-react';
import { Button, Modal } from '../design-system';
import { useCall } from '../context/CallContext';

const VideoTile = ({ stream, muted, className }: { stream: MediaStream | null; muted?: boolean; className?: string }) => {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.srcObject = stream;
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={className}
    />
  );
};

export const CallOverlay = () => {
  const { status, incomingCall, acceptCall, rejectCall, hangup, localStream, remoteStream, toggleMute, toggleCamera, isMuted, isCameraOff } = useCall();

  return (
    <>
      <Modal
        open={status === 'incoming' && incomingCall != null}
        onClose={rejectCall}
        title="Incoming call"
        footer={(
          <div className="flex items-center justify-end gap-3">
            <Button variant="secondary" onClick={rejectCall}>Reject</Button>
            <Button onClick={acceptCall}>Accept</Button>
          </div>
        )}
      >
        <div className="text-sm text-neutral-700">
          User {incomingCall?.fromUserId} is calling…
        </div>
      </Modal>

      {status === 'outgoing' && (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <div className="flex w-full max-w-md items-center justify-between rounded-lg bg-neutral-0 px-4 py-3 shadow-lg">
            <div className="flex items-center gap-2 text-sm text-neutral-800">
              <Video size={18} />
              Calling…
            </div>
            <Button variant="secondary" onClick={hangup}>
              <PhoneOff size={18} />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {status === 'active' && (
        <div className="fixed inset-0 z-50 bg-neutral-900">
          <div className="absolute inset-0">
            <VideoTile stream={remoteStream} className="h-full w-full object-cover" />
          </div>

          <div className="absolute right-4 top-4 h-40 w-28 overflow-hidden rounded-lg bg-neutral-800 shadow-lg">
            <VideoTile stream={localStream} muted className="h-full w-full object-cover" />
          </div>

          <div className="absolute inset-x-0 bottom-6 flex justify-center">
            <div className="flex items-center gap-3 rounded-full bg-black/40 px-4 py-3 backdrop-blur">
              <Button variant="icon" size="md" onClick={toggleMute} aria-label={isMuted ? 'Unmute' : 'Mute'}>
                {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
              </Button>
              <Button variant="icon" size="md" onClick={toggleCamera} aria-label={isCameraOff ? 'Turn camera on' : 'Turn camera off'}>
                {isCameraOff ? <VideoOff size={18} /> : <Video size={18} />}
              </Button>
              <Button variant="primary" size="md" onClick={hangup} className="bg-red-600 hover:bg-red-700">
                <PhoneOff size={18} />
                Hang up
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

