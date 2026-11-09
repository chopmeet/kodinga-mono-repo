import { useEffect, useRef, useState } from 'react';
import { customToast } from '@kodinga/ui';
import i18n from '@/utils/i18n';

export function formatRecordingTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${remMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

async function getRecordingStream(): Promise<MediaStream> {
  const displayStream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      displaySurface: 'browser',
    },
    audio: true,
  });

  let micStream: MediaStream | null = null;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    // Microphone optional
  }

  if (!micStream || micStream.getAudioTracks().length === 0) {
    return displayStream;
  }

  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioCtx = new AudioContextClass();
    const dest = audioCtx.createMediaStreamDestination();

    if (displayStream.getAudioTracks().length > 0) {
      const displaySource = audioCtx.createMediaStreamSource(displayStream);
      displaySource.connect(dest);
    }

    const micSource = audioCtx.createMediaStreamSource(micStream);
    micSource.connect(dest);

    const combinedTracks = [
      ...displayStream.getVideoTracks(),
      ...dest.stream.getAudioTracks(),
    ];

    const combined = new MediaStream(combinedTracks);

    // Stop mic track when screen sharing ends
    displayStream.getVideoTracks()[0]?.addEventListener('ended', () => {
      micStream?.getTracks().forEach((t) => t.stop());
    });

    return combined;
  } catch {
    return displayStream;
  }
}

export function useLiveRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }
    };
  }, [recordedUrl]);

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        customToast.error({ message: i18n.t('live.toasts.recordingUnsupported') });
        return;
      }

      const stream = await getRecordingStream();
      streamRef.current = stream;
      chunksRef.current = [];

      let mimeType = 'video/webm;codecs=vp9,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const fullBlob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(fullBlob);
        const url = URL.createObjectURL(fullBlob);
        setRecordedUrl(url);
        setIsRecording(false);
        setIsPaused(false);
        setIsModalOpen(true);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        // Stop stream tracks
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      // Listen for browser "stop sharing" bar
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      });

      recorder.start(1000); // 1s timeslices
      setIsRecording(true);
      setIsPaused(false);
      setSeconds(0);

      timerRef.current = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);

      customToast.success({ message: i18n.t('live.toasts.recordingStarted') });
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        // User cancelled selection dialog
        return;
      }
      customToast.error({ message: i18n.t('live.toasts.recordingFailed') });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
  };

  const resetRecording = () => {
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedBlob(null);
    setRecordedUrl(null);
    setSeconds(0);
    setIsModalOpen(false);
  };

  return {
    isRecording,
    isPaused,
    seconds,
    formattedDuration: formatRecordingTime(seconds),
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    recordedBlob,
    recordedUrl,
    isModalOpen,
    setIsModalOpen,
    resetRecording,
  };
}
