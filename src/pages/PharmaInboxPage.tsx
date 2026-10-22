import React, { useState, useEffect, useRef } from 'react';
import { Pharmacie, Conversation, Message } from '../types';
import {
  loadConversations,
  loadMessages,
  addMessage,
  subscribeToStore,
  trackPresence,
  cleanExpiredMessages,
  uploadMediaToSupabase,
  isMessageExpired,
} from '../services/store';
import { playNotificationSound } from '../services/sound';
import {
  MessageSquare,
  Send,
  Bell,
  Volume2,
  CheckCheck,
  User,
  Clock,
  Sparkles,
  Phone,
  ShieldCheck,
  Inbox as InboxIcon,
  Mic,
  Camera,
  Paperclip,
  Play,
  Pause,
  X,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';

interface PharmaInboxPageProps {
  pharmacies: Pharmacie[];
  activePharmaId: string;
  onSelectActivePharma: (id: string) => void;
}

// Audio Player component for WhatsApp audio bubbles
const AudioBubblePlayer: React.FC<{ mediaUrl: string; duration?: number; isMe: boolean }> = ({
  mediaUrl,
  duration,
  isMe,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(mediaUrl);
    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      if (!isNaN(audio.duration) && audio.duration !== Infinity) {
        setAudioDuration(Math.round(audio.duration));
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(Math.round(audio.currentTime));
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audioRef.current = null;
    };
  }, [mediaUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('Erreur lecture audio:', err);
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex items-center gap-2.5 py-1 min-w-[200px] sm:min-w-[240px]">
      <button
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 cursor-pointer shadow-sm transition-transform active:scale-95 ${
          isMe ? 'bg-white text-[#0A3D8F] hover:bg-blue-50' : 'bg-[#0A3D8F] text-white hover:bg-[#082e6d]'
        }`}
        title={isPlaying ? 'Pause' : 'Écouter'}
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>

      <div className="flex-1 flex flex-col justify-center gap-1">
        <input
          type="range"
          min="0"
          max={audioDuration || 1}
          value={currentTime}
          onChange={handleSeek}
          className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer ${
            isMe ? 'bg-blue-300 accent-white' : 'bg-gray-300 accent-[#0A3D8F]'
          }`}
        />
        <div className={`flex items-center justify-between text-[10px] font-medium ${
          isMe ? 'text-blue-100' : 'text-gray-500'
        }`}>
          <span>{formatTime(currentTime)}</span>
          <div className="flex items-center gap-1">
            <Mic className={`w-3 h-3 ${isMe ? 'text-blue-200' : 'text-[#0A3D8F]'}`} />
            <span>{formatTime(audioDuration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const PharmaInboxPage: React.FC<PharmaInboxPageProps> = ({
  pharmacies,
  activePharmaId,
  onSelectActivePharma,
}) => {
  const currentPharma = pharmacies.find((p) => p.id === activePharmaId) || pharmacies[0];
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [fullViewImageUrl, setFullViewImageUrl] = useState<string | null>(null);

  // Photo sending
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [pendingPhoto, setPendingPhoto] = useState<{ file: File; previewUrl: string; caption: string } | null>(null);
  const [isSendingPhoto, setIsSendingPhoto] = useState(false);

  // Audio recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);

  const prevMsgCountRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto clean on mount
  useEffect(() => {
    cleanExpiredMessages();
  }, []);

  // Reload conversations
  const refreshConvs = () => {
    if (!currentPharma) return;
    const list = loadConversations(currentPharma.id);
    setConversations(list);
    if (!selectedConv && list.length > 0) {
      setSelectedConv(list[0]);
    }
  };

  useEffect(() => {
    refreshConvs();
  }, [currentPharma?.id]);

  // Load messages for selected conversation (filtering 48h)
  useEffect(() => {
    if (!selectedConv) {
      setMessages([]);
      return;
    }
    const msgs = loadMessages(selectedConv.id);
    setMessages(msgs);
    prevMsgCountRef.current = msgs.length;
  }, [selectedConv]);

  // Subscribe to realtime store & sound notifications
  useEffect(() => {
    if (!currentPharma) return;

    const unsubscribePresence = trackPresence(
      {
        userId: `pharma-${currentPharma.id}`,
        role: 'pharma',
        pharmacieId: currentPharma.id,
        onlineAt: new Date().toISOString(),
      },
      () => {}
    );

    const unsubscribeStore = subscribeToStore(() => {
      refreshConvs();
      if (selectedConv) {
        const msgs = loadMessages(selectedConv.id);
        if (msgs.length > prevMsgCountRef.current) {
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg.sender === 'client' && soundEnabled) {
            playNotificationSound();
          }
        }
        prevMsgCountRef.current = msgs.length;
        setMessages(msgs);
      }
    });

    return () => {
      unsubscribePresence();
      unsubscribeStore();
    };
  }, [currentPharma?.id, selectedConv, soundEnabled]);

  // Auto-scroll: Quand nouveau message arrive, scroll auto en bas avec ref.scrollIntoView({behavior: 'smooth'})
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, selectedConv?.id]);

  const handleSendReply = (quickMsg?: string) => {
    const text = (quickMsg !== undefined ? quickMsg : inputText).trim();
    if (!text || !selectedConv) return;

    addMessage(selectedConv.id, 'pharma', text, { type: 'text' });
    setInputText('');
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  // Photo handlers
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const previewUrl = URL.createObjectURL(file);
    setPendingPhoto({ file, previewUrl, caption: '' });
    e.target.value = '';
  };

  const handleSendPhoto = async () => {
    if (!pendingPhoto || !selectedConv) return;
    setIsSendingPhoto(true);
    try {
      const url = await uploadMediaToSupabase(pendingPhoto.file, 'images');
      addMessage(selectedConv.id, 'pharma', pendingPhoto.caption.trim() || '📷 Photo', {
        type: 'image',
        media_url: url,
      });
      URL.revokeObjectURL(pendingPhoto.previewUrl);
      setPendingPhoto(null);
    } catch (err) {
      console.error('Erreur envoi photo pharma:', err);
    } finally {
      setIsSendingPhoto(false);
    }
  };

  // Audio voice note handlers
  const startRecording = async () => {
    setMicPermissionError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setMicPermissionError("L'enregistrement audio n'est pas supporté par votre navigateur.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      const errObj = err as { name?: string; message?: string };
      console.warn('Microphone permission info:', errObj?.name || errObj?.message || err);
      setIsRecording(false);
      setMicPermissionError("Autorisez micro/galerie/GPS");
      setTimeout(() => setMicPermissionError(null), 5000);
    }
  };

  const stopAndSendRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

    const duration = recordingSeconds || 1;
    const recorder = mediaRecorderRef.current;

    recorder.onstop = async () => {
      try {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        recorder.stream.getTracks().forEach((t) => t.stop());

        if (selectedConv && audioBlob.size > 0) {
          const audioUrl = await uploadMediaToSupabase(audioBlob, 'audio');
          addMessage(selectedConv.id, 'pharma', '🎤 Message vocal', {
            type: 'audio',
            media_url: audioUrl,
            audio_duration: duration,
          });
        }
      } catch (err) {
        console.error('Erreur enregistrement:', err);
      } finally {
        setIsRecording(false);
        setRecordingSeconds(0);
        mediaRecorderRef.current = null;
      }
    };

    recorder.stop();
  };

  const cancelRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsRecording(false);
    setRecordingSeconds(0);
    audioChunksRef.current = [];
    mediaRecorderRef.current = null;
  };

  const pharmaChips = [
    'Bonjour ! Oui, nous avons ce produit en stock.',
    'Veuillez vous munir de votre ordonnance à la pharmacie.',
    'Désolé, ce médicament est actuellement en rupture.',
    'Nous sommes ouverts et de garde toute la nuit jusqu’à 8h.',
  ];

  if (!currentPharma) {
    return <div className="p-8 text-center text-slate-400">Aucune pharmacie active.</div>;
  }

  const visibleMessages = messages.filter((m) => !isMessageExpired(m));

  return (
    <div className="w-full h-full max-w-7xl mx-auto px-2 sm:px-4 py-2 sm:py-3 flex-1 flex flex-col min-h-0 overflow-hidden gap-2 sm:gap-3">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 sm:p-4 rounded-2xl shadow-lg shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold shrink-0">
            <InboxIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-black text-white truncate">
              Messagerie de garde pharmacien - {currentPharma.nom}
            </h1>
            <p className="text-xs text-slate-400 truncate">
              Discussions directes avec les patients de Lomé • Alertes sonores • Auto-clean 48h
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
          {/* Sound Toggle */}
          <button
            onClick={() => {
              playNotificationSound();
              setSoundEnabled(!soundEnabled);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              soundEnabled
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title="Activer/désactiver l'alerte sonore"
          >
            <Volume2 className="w-4 h-4" />
            <span>{soundEnabled ? 'Son ON' : 'Son OFF'}</span>
          </button>
        </div>
      </div>

      {/* Main Inbox Container (Flex layout 100% height) */}
      <div className="flex-1 min-h-0 h-full w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row">
        {/* Conversations List */}
        <div
          className={`${
            selectedConv ? 'hidden md:flex' : 'flex'
          } w-full md:w-80 lg:w-96 border-r border-slate-800 flex-col bg-slate-900/60 min-h-0 h-full shrink-0 overflow-hidden`}
        >
          <div className="p-3 border-b border-slate-800 bg-slate-800/40 flex items-center justify-between shrink-0">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Conversations ({conversations.length})
            </span>
            <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              En direct
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                Aucun message reçu pour le moment.
              </div>
            ) : (
              conversations.map((c) => {
                const isSelected = selectedConv?.id === c.id;
                const formattedTime = c.updated_at
                  ? new Date(c.updated_at).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '';

                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedConv(c)}
                    className={`p-3 rounded-xl cursor-pointer transition-all border min-h-[48px] flex flex-col justify-center ${
                      isSelected
                        ? 'bg-slate-800 border-emerald-500/60 shadow'
                        : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                          <User className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-bold text-white truncate max-w-[140px]">
                          Patient {c.client_id.replace('client-', '#')}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">{formattedTime}</span>
                    </div>

                    <p className="text-xs text-slate-300 truncate pl-9">
                      {c.last_message || 'Nouvelle conversation'}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Messages Thread */}
        <div
          className={`${
            !selectedConv ? 'hidden md:flex' : 'flex'
          } flex-1 flex-col bg-[#efeae2] text-[#111b21] min-h-0 h-full overflow-hidden`}
        >
          {selectedConv ? (
            <div className="w-full h-full flex flex-col min-h-0 overflow-hidden">
              {/* Thread Header */}
              <div className="p-3 border-b border-gray-300 bg-[#0A3D8F] text-white flex items-center justify-between gap-2 shadow-sm shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    onClick={() => setSelectedConv(null)}
                    className="md:hidden p-1.5 rounded-full hover:bg-white/10 text-white font-bold cursor-pointer"
                    title="Retour aux conversations"
                  >
                    ←
                  </button>
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center font-bold text-sm">
                      <User className="w-5 h-5" />
                    </div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0A3D8F] animate-pulse" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">
                      Patient {selectedConv.client_id.replace('client-', '#')}
                    </h3>
                    <p className="text-[11px] text-blue-200 truncate">
                      Messagerie de garde • {currentPharma.nom}
                    </p>
                  </div>
                </div>

                <div className="text-xs text-white/90 truncate font-semibold shrink-0">
                  {currentPharma.nom}
                </div>
              </div>

              {/* Messages Content (Style WhatsApp) - Scrollable avec height calc et flex column */}
              <div
                style={{
                  height: 'calc(100vh - 230px)',
                  overflowY: 'auto',
                  flex: '1 1 0%',
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundImage:
                    'radial-gradient(circle at 50% 50%, rgba(0,0,0,0.03) 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                }}
                className="w-full flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-2.5 !overflow-y-auto"
              >
                {visibleMessages.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 text-xs">
                    Aucun message dans ce fil.
                  </div>
                ) : (
                  visibleMessages.map((m) => {
                    const isMe = m.sender === 'pharma';
                    const time = new Date(m.created_at).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in duration-150`}
                      >
                        <div
                          style={{
                            backgroundColor: isMe ? '#0A3D8F' : '#FFFFFF',
                            borderRadius: isMe ? '8px 8px 0px 8px' : '8px 8px 8px 0px',
                          }}
                          className={`max-w-[85%] px-3.5 py-2 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] border ${
                            isMe ? 'text-white border-blue-900/30' : 'text-[#111b21] border-black/5'
                          }`}
                        >
                          {/* Photo content */}
                          {m.type === 'image' && m.media_url && (
                            <div className="mb-1 rounded-md overflow-hidden bg-black/5 cursor-pointer">
                              <img
                                src={m.media_url}
                                alt="Photo"
                                onClick={() => setFullViewImageUrl(m.media_url || null)}
                                className="max-h-64 w-full object-cover rounded-md hover:opacity-95"
                              />
                            </div>
                          )}

                          {/* Audio voice note content */}
                          {m.type === 'audio' && m.media_url && (
                            <AudioBubblePlayer
                              mediaUrl={m.media_url}
                              duration={m.audio_duration}
                              isMe={isMe}
                            />
                          )}

                          {m.text && m.text !== '📷 Photo' && (
                            <p className={`text-[14px] leading-relaxed break-words whitespace-pre-wrap ${
                              isMe ? 'text-white' : 'text-[#111b21]'
                            }`}>
                              {m.text}
                            </p>
                          )}

                          <div className={`flex items-center justify-end gap-1 text-[10px] mt-1 select-none ${
                            isMe ? 'text-blue-200' : 'text-gray-500'
                          }`}>
                            <span>{time}</span>
                            {isMe && <CheckCheck className="w-3.5 h-3.5 text-blue-200" />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} className="h-2 shrink-0" />
              </div>

              {/* Quick Reply Presets */}
              <div className="px-3 py-1.5 bg-[#f0f2f5] border-t border-gray-300 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                {pharmaChips.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendReply(chip)}
                    className="whitespace-nowrap px-3 py-1 rounded-full bg-white hover:bg-gray-100 text-[#111b21] border border-gray-300 text-[11px] font-medium transition-colors cursor-pointer shrink-0 shadow-2xs"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Send Input Bar */}
              <div className="p-2 sm:p-3 bg-[#f0f2f5] border-t border-gray-300">
                {micPermissionError && (
                  <div className="mb-2 p-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center justify-between gap-2 shadow-xs">
                    <span>{micPermissionError}</span>
                    <button onClick={() => setMicPermissionError(null)} className="p-0.5 text-amber-700">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileSelected}
                  className="hidden"
                />
                <input
                  type="file"
                  ref={cameraInputRef}
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelected}
                  className="hidden"
                />

                {isRecording ? (
                  <div className="flex items-center justify-between gap-3 bg-white px-3 py-2 rounded-xl border border-red-200">
                    <span className="text-xs font-bold text-red-600 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                      Enregistrement vocal ({recordingSeconds}s)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={cancelRecording}
                        className="p-1.5 text-gray-500 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={stopAndSendRecording}
                        className="px-3 py-1.5 rounded-lg bg-[#0A3D8F] hover:bg-[#082f6e] text-white text-xs font-bold flex items-center gap-1"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Envoyer
                      </button>
                    </div>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendReply();
                    }}
                    className="flex items-center gap-1.5 sm:gap-2"
                  >
                    <button
                      type="button"
                      onClick={startRecording}
                      className="w-10 h-10 rounded-full text-gray-600 hover:text-[#0A3D8F] hover:bg-gray-200 flex items-center justify-center shrink-0"
                      title="Enregistrer message vocal"
                    >
                      <Mic className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-10 h-10 rounded-full text-gray-600 hover:text-[#0A3D8F] hover:bg-gray-200 flex items-center justify-center shrink-0"
                      title="Joindre image"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="w-10 h-10 rounded-full text-gray-600 hover:text-[#0A3D8F] hover:bg-gray-200 flex items-center justify-center shrink-0"
                      title="Prendre photo"
                    >
                      <Camera className="w-5 h-5" />
                    </button>

                    <input
                      type="text"
                      placeholder="Répondre au patient..."
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      className="flex-1 h-11 bg-white text-sm text-[#111b21] px-3.5 rounded-xl border border-gray-300 focus:outline-none focus:border-[#0A3D8F] placeholder:text-gray-500 shadow-2xs"
                    />
                    <button
                      type="submit"
                      disabled={!inputText.trim()}
                      className="h-11 w-11 rounded-xl bg-[#0A3D8F] hover:bg-[#082f6e] disabled:opacity-40 text-white font-bold transition-all shadow-md flex items-center justify-center cursor-pointer active:scale-95 shrink-0"
                      title="Envoyer"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </form>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500">
              <MessageSquare className="w-12 h-12 text-gray-400 mb-3" />
              <p className="text-sm font-semibold text-gray-700">
                Sélectionnez une conversation à gauche
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Les questions posées par les clients s’afficheront ici en direct.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Photo Preview Modal */}
      {pendingPhoto && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col justify-between p-4">
          <div className="flex items-center justify-between text-white">
            <span className="text-sm font-bold">Aperçu photo avant envoi</span>
            <button
              onClick={() => {
                URL.revokeObjectURL(pendingPhoto.previewUrl);
                setPendingPhoto(null);
              }}
              className="p-2 text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            <img
              src={pendingPhoto.previewUrl}
              alt="Aperçu"
              className="max-h-[60vh] max-w-full rounded-xl object-contain"
            />
          </div>
          <div className="max-w-md w-full mx-auto flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-slate-700">
            <input
              type="text"
              placeholder="Légende..."
              value={pendingPhoto.caption}
              onChange={(e) => setPendingPhoto({ ...pendingPhoto, caption: e.target.value })}
              className="flex-1 bg-transparent text-white text-xs px-2 focus:outline-none"
            />
            <button
              onClick={handleSendPhoto}
              disabled={isSendingPhoto}
              className="px-4 py-2 bg-[#0A3D8F] hover:bg-[#082f6e] text-white rounded-lg text-xs font-bold"
            >
              Envoyer
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen Image Lightbox */}
      {fullViewImageUrl && (
        <div
          onClick={() => setFullViewImageUrl(null)}
          className="fixed inset-0 z-[120] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <button
            onClick={() => setFullViewImageUrl(null)}
            className="absolute top-4 right-4 p-3 rounded-full bg-white/10 text-white"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={fullViewImageUrl}
            alt="Plein écran"
            className="max-h-[90vh] max-w-full rounded-xl object-contain"
          />
        </div>
      )}
    </div>
  );
};
