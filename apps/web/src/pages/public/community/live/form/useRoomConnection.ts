import { Room, RoomEvent } from 'livekit-client';
import { useEffect, useRef, useState } from 'react';

import { customToast } from '@kodinga-mono-repo/ui';

/**
 * One LiveKit room per session, connected here (not by <LiveKitRoom>): in dev, the double mount of
 * React made it create a second room, connected but not the one the components showed. The host
 * goes on camera and micro once connected; `onLeft` runs when the room is left or lost.
 */
export function useRoomConnection({ serverUrl, token, isHost, onLeft }: { serverUrl: string; token: string; isHost: boolean; onLeft: () => void }) {
  const [room] = useState(() => new Room({ adaptiveStream: true, dynacast: true }));
  const left = useRef(onLeft);
  left.current = onLeft;

  useEffect(() => {
    let active = true;
    // Deferred: the first mount of the double mount is cleaned up before it connects
    const timer = setTimeout(async () => {
      try {
        await room.connect(serverUrl, token);
        if (!active) return;
        room.once(RoomEvent.Disconnected, () => active && left.current());
        if (isHost) {
          await room.localParticipant.enableCameraAndMicrophone().catch(() => {
            customToast.error({ message: 'Caméra ou micro refusés par le navigateur : autorisez-les, puis réactivez-les en bas de l’écran.' });
          });
        }
      } catch {
        if (!active) return;
        customToast.error({ message: 'Impossible de rejoindre le live. Vérifiez votre connexion et réessayez.' });
        left.current();
      }
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
      room.disconnect();
    };
  }, [room, serverUrl, token, isHost]);

  return room;
}
