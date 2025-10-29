"use client";

import { useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription, AlertIcon, Button, FormControl, FormLabel, Input, Spinner, Stack, Text } from '@chakra-ui/react';
import { transcribeAudio } from '../../services/speech';

interface VoiceUploadProps {
  onTranscript: (text: string) => void;
}

export function VoiceUpload({ onTranscript }: VoiceUploadProps) {
  const [fileName, setFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      stopRecordingTimer();
      cleanupMediaStream();
    };
  }, []);

  function stopRecordingTimer() {
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }

  function cleanupMediaStream() {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }

  async function handleAudioBlob(blob: Blob, label: string) {
    setError(null);
    setTranscript(null);
    setFileName(label);
    setIsUploading(true);

    try {
      const result = await transcribeAudio(blob);
      setTranscript(result.text);
      onTranscript(result.text);
    } catch (err) {
      const message = err instanceof Error ? err.message : '科大讯飞转写失败，请稍后再试。';
      setError(message);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    await handleAudioBlob(file, file.name);
  }

  async function startRecording() {
    if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
      setError('当前浏览器不支持 MediaRecorder，请使用语音文件上传。');
      return;
    }

    try {
      const mediaDevices = navigator.mediaDevices;
      if (!mediaDevices?.getUserMedia) {
        throw new Error('未检测到麦克风权限接口，请检查浏览器设置。');
      }

      const stream = await mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const preferredMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';

      const recorder = new MediaRecorder(stream, preferredMime ? { mimeType: preferredMime } : undefined);
      recordingChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setError('录音过程中出现错误，请重新尝试。');
      };

      recorder.onstop = () => {
        stopRecordingTimer();
        mediaRecorderRef.current = null;
        const recordedBlob = new Blob(recordingChunksRef.current, {
          type: recorder.mimeType || preferredMime || 'audio/webm'
        });
        recordingChunksRef.current = [];
        cleanupMediaStream();
        void handleAudioBlob(recordedBlob, '浏览器录音');
      };

      mediaRecorderRef.current = recorder;
      recorder.start(400);
      setIsRecording(true);
      setRecordingDurationMs(0);
      setError(null);
      setTranscript(null);
      setFileName('');

      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDurationMs((prev) => prev + 400);
      }, 400);
    } catch (err) {
      cleanupMediaStream();
      const message = err instanceof Error ? err.message : '无法访问麦克风，请检查浏览器权限。';
      setError(message);
      setIsRecording(false);
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      return;
    }

    if (recorder.state === 'recording') {
      recorder.stop();
    }

    setIsRecording(false);
  }

  function formatDuration(ms: number) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  return (
    <Stack spacing={3}>
      <FormControl>
        <FormLabel>上传语音文件（PCM 16kHz，mono）</FormLabel>
        <Input
          type="file"
          accept=".pcm,.wav,.raw"
          onChange={handleFileChange}
          isDisabled={isUploading}
        />
      </FormControl>

      <FormControl>
        <FormLabel>或直接使用麦克风录制</FormLabel>
        <Stack direction="row" spacing={2} align="center">
          <Button
            size="sm"
            onClick={isRecording ? stopRecording : startRecording}
            variant="solid"
            colorScheme={isRecording ? 'red' : 'blue'}
            isDisabled={isUploading}
          >
            {isRecording ? '结束录音' : '开始录音'}
          </Button>
          <Text fontSize="sm" color={isRecording ? 'red.500' : 'gray.500'}>
            {isRecording ? `录音中（${formatDuration(recordingDurationMs)}）` : '录音将自动转换为 PCM 16kHz 并提交转写'}
          </Text>
        </Stack>
      </FormControl>

      {fileName ? (
        <Text fontSize="sm" color="gray.500">
          已选择：{fileName}
        </Text>
      ) : null}

      {isUploading ? (
        <Stack direction="row" align="center" spacing={2}>
          <Spinner size="sm" />
          <Text fontSize="sm" color="gray.600">
            正在上传并转写，请稍候...
          </Text>
        </Stack>
      ) : null}

      {transcript ? (
        <Alert status="success" variant="left-accent">
          <AlertIcon />
          <AlertDescription fontSize="sm">{transcript}</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert status="error" variant="left-accent">
          <AlertIcon />
          <AlertDescription fontSize="sm">{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          if (isRecording) {
            stopRecording();
          }
          setTranscript(null);
          setError(null);
          setFileName('');
          setRecordingDurationMs(0);
          onTranscript('');
        }}
        isDisabled={!fileName && !transcript && !error && !isRecording}
      >
        重置语音输入
      </Button>
    </Stack>
  );
}
