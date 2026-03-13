import { useState, useRef, useEffect, useCallback, type FormEvent, type KeyboardEvent } from 'react';
import { useChatContext } from '../../../context';
import { useAgentConfig } from '../../../context/AgentContext';
import { useLanguage } from '../../../context/LanguageContext';
import { useLocalizedConfig } from '../../../hooks';
import styles from './ChatInput.module.css';

export function ChatInput() {
  const config = useLocalizedConfig();
  const agentConfig = useAgentConfig();
  const { sendMessage, isLoading } = useChatContext();
  const { t } = useLanguage();
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!isLoading) {
      textareaRef.current?.focus();
    }
  }, [isLoading]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    sendMessage(text);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());

        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        if (blob.size === 0) return;

        setIsTranscribing(true);
        try {
          const formData = new FormData();
          formData.append('audio', blob, `recording.${ext}`);

          const res = await fetch(`${agentConfig.baseURL}/api/voice/transcribe`, {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) throw new Error(await res.text());
          const { text } = await res.json();
          if (text) {
            setInput(prev => prev ? `${prev} ${text}` : text);
            textareaRef.current?.focus();
          }
        } catch (err) {
          console.error('Transcription failed:', err);
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access denied:', err);
    }
  }, [agentConfig.baseURL]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }, []);

  const handleMicClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const isMicBusy = isLoading || isTranscribing;

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.inputWrapper}>
        <textarea
          ref={textareaRef}
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={config.inputPlaceholder}
          disabled={isLoading}
          rows={1}
        />

        {/* Microphone button */}
        <button
          type="button"
          className={`${styles.micBtn} ${isRecording ? styles.micBtnRecording : ''} ${isTranscribing ? styles.micBtnTranscribing : ''}`}
          onClick={handleMicClick}
          disabled={isMicBusy}
          aria-label={isRecording ? t('chat.stopRecording') : t('chat.startRecording')}
          title={isRecording ? t('chat.stopRecording') : t('chat.startRecording')}
        >
          {isTranscribing ? (
            // Spinner
            <svg className={styles.spinner} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          ) : isRecording ? (
            // Stop icon
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
          ) : (
            // Microphone icon
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>

        <button
          type="submit"
          className={styles.sendBtn}
          disabled={!input.trim() || isLoading}
          aria-label={t('chat.send')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </form>
  );
}
