import React, { useState, useEffect, useRef } from 'react';
import { Pharmacie, Message, Conversation } from '../types';
import {
  getOrCreateConversation,
  loadMessages,
  addMessage,
  subscribeToStore,
  trackPresence,
  cleanExpiredMessages,
  uploadMediaToSupabase,
  isMessageExpired
} from '../services/store';
import { playNotificationSound } from '../services/sound';
import {
  Send,
  ArrowLeft,
  Phone,
  Mic,
  Paperclip,
  Camera,
  CheckCheck,
  Play,
  Pause,
  X,
  Trash2,
  Image as ImageIcon,
  ShieldCheck,
  Clock,
  Sparkles,
  MapPin,
  Info,
  AlertCircle,
} from 'lucide-react';

interface ClientChatPageProps {
  pharmacieId: string;
  pharmacies: Pharmacie[];
  onBack: () => void;
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

export const ClientChatPage: React.FC<ClientChatPageProps> = ({
  pharmacieId,
  pharmacies,
  onBack,
}) => {
  const pharmacy = pharmacies.find((p) => p.id === pharmacieId) || pharmacies[0];

  // Persistent client guest ID
  const [clientId] = useState(() => {
    let id = localStorage.getItem('efa_client_id');
    if (!id) {
      id = 'client-' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('efa_client_id', id);
    }
    return id;
  });

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [pharmaOnline, setPharmaOnline] = useState(pharmacy ? pharmacy.is_online : false);
  const [showInfoBanner, setShowInfoBanner] = useState(false);

  // Audio Recording State (MediaRecorder API)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const isHoldingRecordRef = useRef<boolean>(false);

  // Photo / Camera Preview State
  const [pendingPhoto, setPendingPhoto] = useState<{
    file: File;
    previewUrl: string;
    caption: string;
  } | null>(null);
  const [fullViewImageUrl, setFullViewImageUrl] = useState<string | null>(null);

  // Toast permission error state ("Autorisez micro/galerie/GPS")
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const showToast = (msg: string = 'Autorisez micro/galerie/GPS') => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Refs for elements
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const prevMessagesCountRef = useRef(0);

  // Auto clean 48H execution on mount
  useEffect(() => {
    cleanExpiredMessages();
  }, []);

  // Initialize conversation
  useEffect(() => {
    if (!pharmacy) return;
    const conv = getOrCreateConversation(clientId, pharmacy.id);
    setConversation(conv);
    const msgs = loadMessages(conv.id);
    setMessages(msgs);
    prevMessagesCountRef.current = msgs.length;
    setPharmaOnline(pharmacy.is_online);
  }, [pharmacy, clientId]);

  // Subscribe to changes (messages & status)
  useEffect(() => {
    if (!conversation) return;

    const unsubscribeStore = subscribeToStore(() => {
      const updated = loadMessages(conversation.id);
      if (updated.length > prevMessagesCountRef.current) {
        const last = updated[updated.length - 1];
        if (last.sender === 'pharma') {
          playNotificationSound();
        }
      }
      prevMessagesCountRef.current = updated.length;
      setMessages(updated);

      const current = pharmacies.find((p) => p.id === pharmacieId);
      if (current) setPharmaOnline(current.is_online);
    });

    const unsubscribePresence = trackPresence(
      {
        userId: clientId,
        role: 'client',
        pharmacieId: pharmacy?.id,
        onlineAt: new Date().toISOString(),
      },
      (users) => {
        const pharmaActive = users.some((u) => u.role === 'pharma' && u.pharmacieId === pharmacy?.id);
        if (pharmaActive) {
          setPharmaOnline(true);
        }
      }
    );

    return () => {
      unsubscribeStore();
      unsubscribePresence();
    };
  }, [conversation, clientId, pharmacy?.id, pharmacies, pharmacieId]);

  // Auto-scroll to bottom on messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isRecording, pendingPhoto]);

  // Auto-grow textarea height
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 110)}px`;
  };

  // Send Text Message
  const handleSendText = (textToSend?: string) => {
    const text = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!text || !conversation) return;

    setIsSending(true);
    addMessage(conversation.id, 'client', text, { type: 'text' });
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsSending(false);
  };

  // Key press on textarea: Enter sends, Shift+Enter new line
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  // ==========================================
  // VOCAL / MediaRecorder API
  // ==========================================
  const startRecording = async () => {
    setMicPermissionError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setMicPermissionError("L'enregistrement audio n'est pas supporté par votre navigateur.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

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
      isHoldingRecordRef.current = false;
      showToast('Autorisez micro/galerie/GPS');
    }
  };

  const stopAndSendRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const duration = recordingSeconds || 1;
    const recorder = mediaRecorderRef.current;

    recorder.onstop = async () => {
      try {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });

        // Libération des pistes audio du micro
        recorder.stream.getTracks().forEach((track) => track.stop());

        if (conversation && audioBlob.size > 0) {
          setIsSending(true);
          // Envoi de l'audio vers Supabase Storage (avec fallback garanti en Data URL)
          const audioUrl = await uploadMediaToSupabase(audioBlob, 'audio');
          addMessage(conversation.id, 'client', '🎤 Message vocal', {
            type: 'audio',
            media_url: audioUrl,
            audio_duration: duration,
          });
          setIsSending(false);
        }
      } catch (err) {
        console.error('Erreur traitement audio:', err);
        setIsSending(false);
      } finally {
        setIsRecording(false);
        setRecordingSeconds(0);
        mediaRecorderRef.current = null;
        isHoldingRecordRef.current = false;
      }
    };

    recorder.stop();
  };

  const cancelRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }

    setIsRecording(false);
    setRecordingSeconds(0);
    audioChunksRef.current = [];
    mediaRecorderRef.current = null;
    isHoldingRecordRef.current = false;
  };

  // Hold-to-record handlers (Press -> enregistre, Relâche -> envoie)
  const handleRecordMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isHoldingRecordRef.current = true;
    startRecording();
  };

  const handleRecordMouseUp = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isHoldingRecordRef.current && isRecording) {
      stopAndSendRecording();
    }
  };

  const handleRecordTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    isHoldingRecordRef.current = true;
    startRecording();
  };

  const handleRecordTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    if (isHoldingRecordRef.current && isRecording) {
      stopAndSendRecording();
    }
  };

  // ==========================================
  // PHOTO & CAMERA HANDLERS (preview avant envoi)
  // ==========================================
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const previewUrl = URL.createObjectURL(file);
    setPendingPhoto({
      file,
      previewUrl,
      caption: '',
    });
    // Reset file input to allow re-selection
    e.target.value = '';
  };

  const handleSendPhoto = async () => {
    if (!pendingPhoto || !conversation) return;

    setIsSending(true);
    try {
      const imageUrl = await uploadMediaToSupabase(pendingPhoto.file, 'images');
      addMessage(conversation.id, 'client', pendingPhoto.caption.trim() || '📷 Photo', {
        type: 'image',
        media_url: imageUrl,
      });

      URL.revokeObjectURL(pendingPhoto.previewUrl);
      setPendingPhoto(null);
    } catch (err) {
      console.error('Erreur envoi photo:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleCancelPhoto = () => {
    if (pendingPhoto) {
      URL.revokeObjectURL(pendingPhoto.previewUrl);
      setPendingPhoto(null);
    }
  };

  // Bouton "Map" : ouvre Google Maps avec l'itinéraire automatique Client -> Pharmacie
  const handleOpenGoogleMapsItinerary = () => {
    const destLat = pharmacy.lat;
    const destLng = pharmacy.lng;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const latClient = pos.coords.latitude;
          const lngClient = pos.coords.longitude;
          const url = `https://www.google.com/maps/dir/?api=1&origin=${latClient},${lngClient}&destination=${destLat},${destLng}&travelmode=driving`;
          window.open(url, '_blank');
        },
        (err) => {
          console.warn('Geolocation error for itinerary:', err);
          const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`;
          window.open(fallbackUrl, '_blank');
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`;
      window.open(fallbackUrl, '_blank');
    }
  };

  // Envoi de la position GPS avec gestion d'autorisation
  const handleSendLocation = () => {
    if (!navigator.geolocation) {
      showToast('Autorisez micro/galerie/GPS');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        const itineraryUrl = `https://www.google.com/maps/dir/?api=1&origin=${latitude.toFixed(5)},${longitude.toFixed(5)}&destination=${pharmacy.lat},${pharmacy.lng}&travelmode=driving`;
        const text = `📍 Ma position GPS & itinéraire : ${itineraryUrl}`;
        if (conversation) {
          addMessage(conversation.id, 'client', text, { type: 'text' });
        }
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation error / permission denied:', err);
        showToast('Autorisez micro/galerie/GPS');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );
  };

  // Ouverture galerie avec gestion d'autorisation
  const handleOpenGallery = () => {
    try {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      } else {
        showToast('Autorisez micro/galerie/GPS');
      }
    } catch (err) {
      console.warn('Gallery error:', err);
      showToast('Autorisez micro/galerie/GPS');
    }
  };

  // Quick chips for rapid Lomé pharmacy interactions
  const quickChips = [
    'Bonjour, avez-vous ce médicament en stock ?',
    'Quel est le tarif et la posologie ?',
    'Proposez-vous la livraison à Lomé ?',
    'Je serai là dans 15 minutes, êtes-vous ouverts ?',
  ];

  if (!pharmacy) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center bg-[#0b141a] text-slate-300 p-4">
        <p>Pharmacie introuvable.</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 rounded-xl bg-[#0A3D8F] hover:bg-[#082e6d] text-white font-bold"
        >
          Retour à la carte
        </button>
      </div>
    );
  }

  // Filter 48h for frontend safety
  const visibleMessages = messages.filter((m) => !isMessageExpired(m));

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full flex flex-col bg-[#efeae2] relative overflow-hidden font-sans pt-[60px]">
      {/* 1. EFA GARDE HEADER : fixed top h-[60px] BG BLEU #0A3D8F */}
      <header className="fixed top-0 left-0 right-0 h-[60px] bg-[#0A3D8F] text-white px-2 sm:px-4 flex items-center justify-between z-50 shadow-md">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Back button [←] */}
          <button
            onClick={onBack}
            className="p-1.5 -ml-1 rounded-full hover:bg-white/10 active:bg-white/20 text-white transition-colors cursor-pointer"
            title="Retour à la carte"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          {/* Pharmacy Profile Photo / Avatar */}
          <div className="relative shrink-0">
            {pharmacy.photo_url ? (
              <img
                src={pharmacy.photo_url}
                alt={pharmacy.nom}
                className="w-10 h-10 rounded-full object-cover border border-white/30 shadow-sm"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-white text-[#0A3D8F] font-black text-base flex items-center justify-center shadow-sm border border-blue-200">
                ✚
              </div>
            )}
            {/* Presence dot */}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0A3D8F] ${
                pharmaOnline ? 'bg-emerald-400 animate-pulse' : 'bg-gray-400'
              }`}
              title={pharmaOnline ? 'En ligne' : 'Hors ligne'}
            />
          </div>

          {/* Titre responsive : "Messagerie de garde pharmacie [Nom Pharmacie]" */}
          <div className="flex flex-col min-w-0 max-w-[60vw] sm:max-w-none flex-1 justify-center overflow-hidden pr-1">
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-1.5 min-w-0 flex-wrap text-sm md:text-base">
              <span className="font-bold text-white truncate max-w-[60vw] sm:max-w-none leading-tight">
                Messagerie de garde pharmacie
              </span>
              <span className="hidden sm:inline text-white/60">•</span>
              <span className="font-extrabold text-white truncate max-w-[60vw] sm:max-w-none leading-tight">
                {pharmacy.nom}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[11px] text-white/90">
              {pharmaOnline ? (
                <span className="text-emerald-300 font-semibold flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  en ligne
                </span>
              ) : (
                <span className="text-white/70 shrink-0">pharmacien de garde</span>
              )}
              <span className="text-white/40">•</span>
              <span className="truncate max-w-[80px] sm:max-w-[160px] text-white/80">
                {pharmacy.quartier || 'Lomé'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Bouton "Map" : itinéraire automatique Google Maps client -> pharmacie */}
          <button
            onClick={handleOpenGoogleMapsItinerary}
            className="px-2.5 py-1.5 rounded-full bg-white/15 hover:bg-white/25 active:bg-white/30 text-white flex items-center gap-1 text-xs font-bold border border-white/20 transition-all cursor-pointer shadow-xs"
            title="Itinéraire Google Maps vers la pharmacie"
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-300" />
            <span className="text-[11px] sm:text-xs">Map</span>
          </button>

          {/* Info toggle */}
          <button
            onClick={() => setShowInfoBanner(!showInfoBanner)}
            className="p-1.5 sm:p-2 rounded-full hover:bg-white/10 text-white/90 transition-colors cursor-pointer"
            title="Détails officine"
          >
            <Info className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Call button [📞] */}
          <a
            href={`tel:${pharmacy.tel}`}
            className="p-1.5 sm:px-3 sm:py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center gap-1.5 text-xs font-semibold border border-white/20 transition-all cursor-pointer"
            title="Appeler l'officine"
          >
            <Phone className="w-4 h-4" />
            <span className="hidden sm:inline">Appeler</span>
          </a>
        </div>
      </header>

      {/* Toast Notification : "Autorisez micro/galerie/GPS" */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] bg-slate-900/95 text-white border-2 border-amber-400 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs sm:text-sm font-black animate-in fade-in slide-in-from-top-3 max-w-sm w-[90%] pointer-events-auto">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
          <span className="flex-1">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 rounded-full text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Info Dropdown Banner */}
      {showInfoBanner && (
        <div className="bg-[#1f2c34] text-white px-4 py-3 text-xs border-b border-gray-700 shadow-lg flex items-center justify-between gap-3 animate-in slide-in-from-top-2 duration-150 z-30">
          <div className="space-y-0.5">
            <p className="font-bold text-emerald-400">{pharmacy.nom}</p>
            <p className="text-gray-300 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              {pharmacy.adresse}
            </p>
            <p className="text-gray-400 text-[11px]">Contact : {pharmacy.tel}</p>
          </div>
          <button
            onClick={() => setShowInfoBanner(false)}
            className="p-1 rounded-full text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. MESSAGES SCROLL AREA (Responsive 100dvh, scroll auto bottom) */}
      <div
        className="flex-1 overflow-y-auto p-4 pb-24 md:pb-24 space-y-2.5 chat-messages-area scroll-smooth"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 50%, rgba(0,0,0,0.03) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      >
        {/* 48H Auto-Clean Security Notice Banner */}
        <div className="max-w-md mx-auto bg-amber-50/90 border border-amber-200/80 rounded-xl p-2.5 text-center shadow-xs">
          <div className="flex items-center justify-center gap-1.5 text-amber-800 text-[11px] font-bold">
            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>CONFIDENTIALITÉ MÉDICALE & AUTO-CLEAN 48H</span>
          </div>
          <p className="text-[10px] text-amber-700 mt-0.5 leading-snug">
            Vos messages et ordonnances sont strictement confidentiels et sont automatiquement effacés après 48h.
          </p>
        </div>

        {visibleMessages.length === 0 ? (
          <div className="text-center py-16 text-gray-500 text-xs">
            <div className="w-12 h-12 rounded-full bg-white/80 shadow-sm mx-auto flex items-center justify-center text-[#008069] mb-3 text-lg font-bold">
              💬
            </div>
            <p className="font-semibold text-gray-700">Démarrez votre échange WhatsApp</p>
            <p className="text-gray-500 text-[11px] mt-1 max-w-xs mx-auto">
              Demandez la disponibilité d'un médicament, vos posologies ou transmettez votre ordonnance.
            </p>
          </div>
        ) : (
          visibleMessages.map((m) => {
            const isMe = m.sender === 'client';
            const time = new Date(m.created_at).toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={m.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in duration-150`}
              >
                {/* 
                  STYLE WHATSAPP :
                  - Moi (envoyé) : BLEU logo EFA GARDE #0A3D8F avec texte blanc, border-radius 8px 8px 0 8px
                  - Pharmacien (reçu) : bulles blanc #FFFFFF, border-radius 8px 8px 8px 0
                */}
                <div
                  style={{
                    backgroundColor: isMe ? '#0A3D8F' : '#FFFFFF',
                    borderRadius: isMe ? '8px 8px 0px 8px' : '8px 8px 8px 0px',
                  }}
                  className={`max-w-[78%] md:max-w-[65%] px-3.5 py-2 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] border text-sm md:text-base ${
                    isMe
                      ? 'text-white border-blue-900/30'
                      : 'text-[#111b21] border-black/5'
                  }`}
                >
                  {/* Photo content */}
                  {m.type === 'image' && m.media_url && (
                    <div className="mb-1 rounded-md overflow-hidden bg-black/5 cursor-pointer">
                      <img
                        src={m.media_url}
                        alt="Photo envoyée"
                        onClick={() => setFullViewImageUrl(m.media_url || null)}
                        className="max-h-72 w-full object-cover rounded-md hover:opacity-95 transition-opacity"
                        loading="lazy"
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

                  {/* Text message content */}
                  {m.text && m.text !== '📷 Photo' && (
                    <p className={`text-sm md:text-base leading-relaxed break-words whitespace-pre-wrap font-normal ${
                      isMe ? 'text-white' : 'text-[#111b21]'
                    }`}>
                      {m.text}
                    </p>
                  )}

                  {/* Timestamp & read status */}
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
        <div ref={messagesEndRef} />
      </div>

      {/* 3. INPUT BARRE EN BAS FIXED : position fixed bottom-0 left-0 right-0, avec safe-area-inset-bottom, bg-[#f0f0f0] p-2, flex gap-2 items-end */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#f0f0f0] border-t border-gray-300/80 shadow-md chat-input-bar pb-safe">
        {/* Quick Suggestions Chips */}
        <div className="px-3 pt-1.5 pb-1 flex items-center gap-2 overflow-x-auto no-scrollbar max-w-5xl mx-auto w-full">
          {quickChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSendText(chip)}
              className="whitespace-nowrap px-3 py-1 rounded-full bg-white hover:bg-gray-50 text-[#111b21] border border-gray-300 text-xs font-medium transition-colors cursor-pointer shrink-0 shadow-2xs"
            >
              {chip}
            </button>
          ))}
        </div>

        <div className="p-2 pt-0 max-w-5xl mx-auto w-full">
          {/* Microphone Permission Toast Banner */}
          {micPermissionError && (
            <div className="mb-2 p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center justify-between gap-2 shadow-sm animate-in fade-in">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-medium">{micPermissionError}</span>
              </div>
              <button
                onClick={() => setMicPermissionError(null)}
                className="p-1 text-amber-700 hover:text-amber-900 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Hidden File Inputs */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*,.pdf,.doc,.docx"
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

          {/* Live Audio Recording Display */}
          {isRecording ? (
            <div className="flex items-center justify-between gap-3 bg-white px-3 py-2 rounded-full border border-red-200 shadow-inner min-h-[44px]">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-ping ml-1" />
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-red-600 flex items-center gap-1">
                    Enregistrement vocal ({recordingSeconds}s)
                  </span>
                  <span className="text-[10px] text-gray-500">
                    Relâchez ou cliquez pour envoyer
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Cancel Button */}
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors flex items-center justify-center cursor-pointer"
                  title="Supprimer l'enregistrement"
                >
                  <Trash2 className="w-5 h-5" />
                </button>

                {/* Stop & Send Button */}
                <button
                  type="button"
                  onClick={stopAndSendRecording}
                  className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-[#0A3D8F] hover:bg-[#082e6d] text-white flex items-center justify-center shadow-md active:scale-95 transition-all cursor-pointer"
                  title="Envoyer le message vocal"
                >
                  <Send className="w-5 h-5 fill-current" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-end gap-1 sm:gap-2">
              {/* 1. [🎤 micro - navigator.mediaDevices] */}
              <button
                type="button"
                onMouseDown={handleRecordMouseDown}
                onMouseUp={handleRecordMouseUp}
                onTouchStart={handleRecordTouchStart}
                onTouchEnd={handleRecordTouchEnd}
                onClick={() => {
                  if (!isHoldingRecordRef.current) {
                    if (isRecording) stopAndSendRecording();
                    else startRecording();
                  }
                }}
                className="w-10 h-10 sm:w-11 sm:h-11 min-w-[40px] min-h-[40px] rounded-full text-gray-600 hover:text-[#0A3D8F] hover:bg-blue-50 active:bg-blue-100 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                title="Maintenir pour enregistrer un message vocal (Micro)"
              >
                <Mic className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </button>

              {/* 2. [🖼️ Galerie - input accept="image/*"] */}
              <button
                type="button"
                onClick={handleOpenGallery}
                className="w-10 h-10 sm:w-11 sm:h-11 min-w-[40px] min-h-[40px] rounded-full text-gray-600 hover:text-[#0A3D8F] hover:bg-blue-50 flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                title="Galerie photo"
              >
                <ImageIcon className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </button>

              {/* 3. [📍 Position GPS - navigator.geolocation] */}
              <button
                type="button"
                disabled={isLocating}
                onClick={handleSendLocation}
                className="w-10 h-10 sm:w-11 sm:h-11 min-w-[40px] min-h-[40px] rounded-full text-gray-600 hover:text-[#0A3D8F] hover:bg-blue-50 flex items-center justify-center shrink-0 transition-colors cursor-pointer disabled:opacity-50"
                title="Envoyer ma position GPS"
              >
                <MapPin className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
              </button>

              {/* 4. [input text "Message"] : rounded-full, min-h-[44px] */}
              <div className="flex-1 bg-white rounded-full border border-gray-300 focus-within:border-[#0A3D8F] shadow-xs px-3 sm:px-4 py-1.5 flex items-center transition-colors min-h-[44px]">
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Message"
                  rows={1}
                  className="w-full bg-transparent text-[#111b21] text-sm md:text-base resize-none focus:outline-none placeholder:text-gray-500 max-h-28 overflow-y-auto leading-relaxed py-1"
                />
              </div>

              {/* 5. [➤ envoyer] */}
              <button
                type="button"
                disabled={!inputText.trim() || isSending}
                onClick={() => handleSendText()}
                className="w-10 h-10 sm:w-11 sm:h-11 min-w-[40px] min-h-[40px] rounded-full bg-[#0A3D8F] hover:bg-[#082e6d] disabled:opacity-40 disabled:hover:bg-[#0A3D8F] text-white flex items-center justify-center shrink-0 shadow-md transition-all active:scale-95 cursor-pointer"
                title="Envoyer"
              >
                <Send className="w-5 h-5 fill-current" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 4. PHOTO PREVIEW MODAL (preview avant envoi) */}
      {pendingPhoto && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col justify-between p-3 sm:p-6 animate-in fade-in duration-200">
          {/* Top Preview Bar */}
          <div className="flex items-center justify-between text-white">
            <span className="text-sm font-semibold flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-emerald-400" />
              Aperçu photo avant envoi
            </span>
            <button
              onClick={handleCancelPhoto}
              className="p-2 rounded-full hover:bg-white/20 text-white transition-colors cursor-pointer"
              title="Annuler"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Centered Image Preview */}
          <div className="flex-1 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
            <img
              src={pendingPhoto.previewUrl}
              alt="Aperçu avant envoi"
              className="max-h-[60vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/10"
            />
          </div>

          {/* Bottom Bar: Caption + Send */}
          <div className="max-w-xl w-full mx-auto space-y-2">
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700 rounded-2xl px-3 py-1.5 shadow-xl">
              <input
                type="text"
                placeholder="Ajouter une légende (optionnel)..."
                value={pendingPhoto.caption}
                onChange={(e) =>
                  setPendingPhoto({ ...pendingPhoto, caption: e.target.value })
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSendPhoto();
                  }
                }}
                className="flex-1 bg-transparent text-white text-sm focus:outline-none placeholder:text-gray-400 py-2"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSendPhoto}
                disabled={isSending}
                className="w-11 h-11 rounded-xl bg-[#0A3D8F] hover:bg-[#082e6d] disabled:opacity-50 text-white flex items-center justify-center shadow-lg transition-all active:scale-95 cursor-pointer shrink-0"
                title="Envoyer la photo"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <p className="text-center text-[11px] text-gray-400">
              La photo sera transmise de manière sécurisée au pharmacien de garde.
            </p>
          </div>
        </div>
      )}

      {/* Fullscreen Image Lightbox */}
      {fullViewImageUrl && (
        <div
          onClick={() => setFullViewImageUrl(null)}
          className="fixed inset-0 z-[120] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in"
        >
          <button
            onClick={() => setFullViewImageUrl(null)}
            className="absolute top-4 right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"
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
