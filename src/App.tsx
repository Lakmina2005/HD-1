import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  Check,
  ClipboardPaste,
  Code2,
  Download,
  ExternalLink,
  FileCode,
  Film,
  FolderOpen,
  Globe,
  Layers,
  Loader2,
  Maximize2,
  Moon,
  Music,
  PictureInPicture2,
  Play,
  Plus,
  Search,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { BackgroundMotif } from './components/BackgroundMotif';
import { STANDALONE_HTML_CODE } from './data/standaloneHtmlTemplate';

type Language = 'en' | 'si';
type WorkspaceTab = 'downloader' | 'search' | 'files';

interface StreamOption {
  id: string;
  label: string;
  quality: string;
  height: number;
  container: 'mp4' | 'mp3' | 'm4a';
  kind: 'video' | 'audio';
  sizeBytes: number;
  transcoded?: boolean;
}

interface ResolvedMedia {
  token: string;
  platform: string;
  extractedUrl: string;
  title: string;
  authorHandle: string;
  authorName: string;
  duration: number;
  thumbnailUrl: string | null;
  previewUrl: string | null;
  options: StreamOption[];
}

interface BatchItem {
  id: string;
  rawInput: string;
  extractedPreview: string;
  status: 'queued' | 'fetching' | 'done' | 'error';
  title?: string;
  error?: string;
}

interface SearchResultItem {
  id: string;
  platform: string;
  title: string;
  author: string;
  durationLabel: string;
  thumbnailUrl: string;
  url: string;
}

interface SavedLibraryItem {
  id: string;
  token?: string;
  platform: string;
  title: string;
  author: string;
  quality: string;
  container: 'mp4' | 'mp3' | 'm4a' | 'image';
  sizeBytes: number;
  createdAt: string;
  downloadUrl?: string;
  previewUrl?: string | null;
  isLocalStatus?: boolean;
}

interface ActivePlayerMedia {
  title: string;
  author: string;
  streamUrl: string;
  downloadUrl?: string;
}

const SUPPORTED_PLATFORMS = [
  'TikTok / Lite',
  'YouTube',
  'Facebook',
  'Instagram',
  'WhatsApp Status',
  'X (Twitter)',
  'Vimeo',
  'Dailymotion',
];

const TIKTOK_LITE_SAMPLE =
  'https://vm.tiktok.com/ZSshAJnxm/ This post is shared via TikTok Lite. Download TikTok Lite to enjoy more posts: https://www.tiktok.com/tiktoklite';

const COPY = {
  en: {
    navDownloader: 'Downloader',
    navSearch: 'Search & Player',
    navFiles: 'File Manager',
    navCode: 'HTML Code',
    navCta: 'Get HTML Code',
    tabDownloader: 'Downloader & Batch',
    tabSearch: 'Search & Browser',
    tabFiles: 'WhatsApp & File Manager',
    darkLabel: 'Dark',
    lightLabel: 'Light',
    headline: 'All-in-One HD Video & MP3 Downloader',
    subheadline:
      'Paste any link or TikTok Lite share message to download in 144p, 360p, 720p HD, 1080p Full HD, 4K, or convert directly to MP3 & M4A audio.',
    inputPlaceholder:
      'Paste video URL or TikTok Lite share message (e.g. https://vm.tiktok.com/ZSshAJnxm/ This post is shared via TikTok Lite...)',
    pasteBtn: 'Paste',
    sampleBtn: 'Try TikTok Lite Format',
    fetchBtn: 'Fetch Formats',
    fetchingBtn: 'Fetching...',
    addToBatchBtn: 'Add to Batch',
    extractedLabel: 'Detected video link',
    emptyError: 'Please paste a link or share message first.',
    chooseQualityTitle: 'Select Video Resolution or Audio Format',
    videoTab: 'Video (144p – 4K)',
    audioTab: 'Audio (MP3 / M4A)',
    playInAppBtn: 'Play in App',
    floatingPipBtn: 'Floating PiP',
    batchTitle: 'Batch Download Queue',
    batchSubtitle:
      'Paste multiple links (one per line) or queue videos from Search to download them together.',
    batchTextareaPlaceholder:
      'Paste multiple video links, one per line...\nhttps://vm.tiktok.com/ZSshAJnxm/\nhttps://www.youtube.com/watch?v=...',
    batchQualityLabel: 'Target Format:',
    batchAddLinesBtn: 'Queue Lines',
    batchStartBtn: 'Download All',
    batchClearBtn: 'Clear Queue',
    searchTitle: 'Built-in Video Search & Site Browser',
    searchSubtitle:
      'Search videos directly inside SnapTok without leaving the app, preview them in the player, or fetch HD/MP3 downloads.',
    searchPlaceholder: 'Search YouTube & Dailymotion videos (e.g. Sinhala songs, 4K nature)...',
    searchBtn: 'Search',
    quickSitesLabel: 'Open Platform in New Tab or Paste Links From:',
    filesTitle: 'Download Manager & WhatsApp Status Saver',
    filesSubtitle:
      'Manage your downloaded videos and MP3/M4A files, or open your phone’s WhatsApp Status folder (.Statuses) to preview and save statuses.',
    waStatusTitle: 'WhatsApp Status & Local Media Picker',
    waStatusDesc:
      'Select status files or choose your WhatsApp/Media/.Statuses folder on your device to preview and save copies cleanly.',
    waPickFilesBtn: 'Pick Status Files',
    waPickFolderBtn: 'Select Status Folder',
    filterAll: 'All Files',
    filterVideo: 'Video (MP4)',
    filterAudio: 'Audio (MP3/M4A)',
    emptyLibrary: 'No saved files yet. Download a video, extract MP3, or pick WhatsApp statuses.',
    stepsHeading: 'How to Save & Find Downloaded Files',
    step1Title: 'Step 1. Paste Link or Share Message',
    step1Items: [
      'Copy any link from TikTok, TikTok Lite, YouTube, Facebook, Instagram, X, Vimeo, or Dailymotion',
      'Even if TikTok Lite adds promotional text, SnapTok automatically extracts the video URL',
      'Choose 144p, 360p, 720p HD, 1080p Full HD, 4K, MP3, or M4A',
    ],
    step2Title: 'Step 2. Find the Saved File',
    step2Items: [
      'Click on the popup which appears in your browser when the download finishes',
      'Find it in the "Downloads" of your browser or inside File Manager above',
      'Find it in the notification bar of your phone',
    ],
    codeHeading: 'Standalone HTML Source Code',
    codeSubheading:
      'Copy this complete HTML code or download snaptok-hd.html with Dark Mode, TikTok Lite link extraction, batch queue, and PiP player included.',
    copyCodeBtn: 'Copy HTML Code',
    copiedCodeBtn: 'Copied HTML',
    downloadHtmlBtn: 'Download snaptok-hd.html',
    footerText: 'SnapTok HD — Multi-platform HD video & MP3 downloader with built-in player.',
  },
  si: {
    navDownloader: 'ඩවුන්ලෝඩරය',
    navSearch: 'සෙවුම සහ Player',
    navFiles: 'ගොනු කළමනාකරු',
    navCode: 'HTML කේතය',
    navCta: 'HTML කේතය ගන්න',
    tabDownloader: 'ඩවුන්ලෝඩරය සහ Batch',
    tabSearch: 'Built-in සෙවුම',
    tabFiles: 'WhatsApp සහ ගොනු',
    darkLabel: 'Dark',
    lightLabel: 'Light',
    headline: 'සියලුම සමාජ මාධ්‍ය HD වීඩියෝ සහ MP3 ඩවුන්ලෝඩරය',
    subheadline:
      'TikTok (TikTok Lite ඇතුළුව), YouTube, Facebook, Instagram, X, Vimeo හෝ Dailymotion ලින්ක් ඇතුළත් කර 144p සිට 4K දක්වා වීඩියෝ හෝ MP3/M4A සින්දු ලබාගන්න.',
    inputPlaceholder:
      'වීඩියෝ ලින්ක් එක හෝ TikTok Lite share text එක Paste කරන්න (උදා: https://vm.tiktok.com/ZSshAJnxm/ This post is shared via TikTok Lite...)',
    pasteBtn: 'Paste',
    sampleBtn: 'TikTok Lite උදාහරණයක්',
    fetchBtn: 'ලබාගන්න',
    fetchingBtn: 'සොයමින්...',
    addToBatchBtn: 'Batch එකට එක් කරන්න',
    extractedLabel: 'හඳුනාගත් වීඩියෝ ලින්ක් එක',
    emptyError: 'කරුණාකර පළමුව වීඩියෝ ලින්ක් එක හෝ share text එක Paste කරන්න.',
    chooseQualityTitle: 'ගුණාත්මකභාවය (Resolution) හෝ ශ්‍රව්‍ය (MP3/M4A) තෝරන්න',
    videoTab: 'වීඩියෝ (144p – 4K)',
    audioTab: 'සින්දු (MP3 / M4A)',
    playInAppBtn: 'ඇප් එකේ නරඹන්න',
    floatingPipBtn: 'Floating PiP',
    batchTitle: 'එකවර කිහිපයක් ඩවුන්ලෝඩ් කිරීම (Batch Download)',
    batchSubtitle:
      'ලින්ක් කිහිපයක් පේළි වශයෙන් ඇතුළත් කර හෝ Search එකෙන් එක් කර එකවර ඩවුන්ලෝඩ් කරගන්න.',
    batchTextareaPlaceholder:
      'ලින්ක් කිහිපයක් පේළි වශයෙන් මෙහි Paste කරන්න...\nhttps://vm.tiktok.com/ZSshAJnxm/\nhttps://www.youtube.com/watch?v=...',
    batchQualityLabel: 'අවශ්‍ය Format එක:',
    batchAddLinesBtn: 'පේළි එක් කරන්න',
    batchStartBtn: 'සියල්ල ඩවුන්ලෝඩ් කරන්න',
    batchClearBtn: 'හිස් කරන්න',
    searchTitle: 'Built-in වීඩියෝ සෙවුම සහ නැරඹීම',
    searchSubtitle:
      'වෙනත් ඇප් වෙත නොගොස් මෙහි සිටම වීඩියෝ සොයා, Built-in Player හෝ Floating PiP හරහා නරඹා HD/MP3 ලෙස ඩවුන්ලෝඩ් කරගන්න.',
    searchPlaceholder: 'වීඩියෝ හෝ සින්දු සොයන්න (උදා: Sinhala songs, 4K Sri Lanka)...',
    searchBtn: 'සොයන්න',
    quickSitesLabel: 'වෙබ් අඩවි වලට පිවිස ලින්ක් ලබාගන්න:',
    filesTitle: 'ගොනු කළමනාකරණය සහ WhatsApp Status Saver',
    filesSubtitle:
      'ඔබ ඩවුන්ලෝඩ් කළ වීඩියෝ සහ ගීත කළමනාකරණය කරන්න, නැතහොත් දුරකථනයේ WhatsApp Status ගොනු තෝරා Save කරගන්න.',
    waStatusTitle: 'WhatsApp Status සහ දේශීය ගොනු Saver',
    waStatusDesc:
      'ඔබේ දුරකථනයේ WhatsApp/Media/.Statuses ෆෝල්ඩරය හෝ status ගොනු තෝරා නරඹා Save කරගන්න.',
    waPickFilesBtn: 'Status ගොනු තෝරන්න',
    waPickFolderBtn: 'Status ෆෝල්ඩරය තෝරන්න',
    filterAll: 'සියල්ල',
    filterVideo: 'වීඩියෝ (MP4)',
    filterAudio: 'සින්දු (MP3/M4A)',
    emptyLibrary: 'තවමත් ගොනු කිසිවක් නැත. වීඩියෝවක් ඩවුන්ලෝඩ් කරන්න හෝ WhatsApp Status තෝරන්න.',
    stepsHeading: 'ඩවුන්ලෝඩ් කර සොයාගන්නා ආකාරය',
    step1Title: 'Step 1. ලින්ක් එක හෝ Share Text එක ඇතුළත් කරන්න',
    step1Items: [
      'TikTok, TikTok Lite, YouTube, Facebook, Instagram, X, Vimeo හෝ Dailymotion වලින් ලින්ක් එක Copy කරන්න',
      'TikTok Lite මඟින් ලැබෙන අමතර වචන සහිත text එක එලෙසම Paste කළත් ස්වයංක්‍රීයව වීඩියෝ ලින්ක් එක හඳුනා ගනී',
      '144p, 360p, 720p HD, 1080p Full HD, 4K හෝ MP3/M4A තෝරන්න',
    ],
    step2Title: 'Step 2. ඩවුන්ලෝඩ් කළ ගොනුව සොයාගන්න',
    step2Items: [
      'ඩවුන්ලෝඩ් වී අවසන් වූ පසු බ්‍රව්සරයේ පෙන්වන Popup එක ක්ලික් කරන්න',
      'බ්‍රව්සරයේ "Downloads" කොටසින් හෝ ඉහත File Manager තුළින් සොයාගන්න',
      'දුරකථනයේ Notification bar එකෙන් කෙලින්ම විවෘත කරගන්න',
    ],
    codeHeading: 'මෙම වෙබ් අඩවියේ HTML කේතය (Standalone HTML)',
    codeSubheading:
      'Dark Mode, TikTok Lite ලින්ක් හඳුනාගැනීම, Batch Download සහ Floating PiP Player සහිත සම්පූර්ණ HTML කේතය Copy හෝ Download කරගන්න.',
    copyCodeBtn: 'HTML කේතය Copy කරන්න',
    copiedCodeBtn: 'Copy විය',
    downloadHtmlBtn: 'snaptok-hd.html ඩවුන්ලෝඩ් කරන්න',
    footerText: 'SnapTok HD — සියලුම සමාජ මාධ්‍ය HD වීඩියෝ සහ MP3 ඩවුන්ලෝඩ් මෙවලම.',
  },
};

function extractCleanUrlClient(rawText: string): string | null {
  const matches = rawText.match(/https?:\/\/[^\s"'<>]+/gi) || [];
  const filtered = matches
    .map((u) => u.replace(/[.,!?;:)\]]+$/, ''))
    .filter((u) => {
      const lower = u.toLowerCase();
      return (
        !lower.includes('tiktok.com/tiktoklite') &&
        !lower.includes('tiktok.com/download') &&
        !lower.includes('play.google.com') &&
        !lower.includes('apps.apple.com')
      );
    });
  if (filtered.length > 0) {
    const preferred = filtered.find((u) =>
      /vm\.tiktok|vt\.tiktok|\/video\/|\/reel|\/watch|\/shorts\/|\/status\//i.test(u)
    );
    return preferred || filtered[0];
  }
  return null;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return 'Stream Ready';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function App() {
  const [lang, setLang] = useState<Language>('si');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('snaptok_dark') === 'true';
    }
    return false;
  });
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('downloader');

  // Downloader state
  const [rawInput, setRawInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentMedia, setCurrentMedia] = useState<ResolvedMedia | null>(null);
  const [formatFilter, setFormatFilter] = useState<'video' | 'audio'>('video');
  const [brokenThumbs, setBrokenThumbs] = useState<Record<string, boolean>>({});

  // Batch download state
  const [batchText, setBatchText] = useState('');
  const [batchQueue, setBatchQueue] = useState<BatchItem[]>([]);
  const [batchTargetQuality, setBatchTargetQuality] = useState<string>('1080p');
  const [batchRunning, setBatchRunning] = useState(false);

  // Built-in search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  // File manager & WhatsApp Status state
  const [savedFiles, setSavedFiles] = useState<SavedLibraryItem[]>([]);
  const [fileFilter, setFileFilter] = useState<'all' | 'video' | 'audio'>('all');

  // Floating / Built-in Player state
  const [playerMedia, setPlayerMedia] = useState<ActivePlayerMedia | null>(null);
  const videoPlayerRef = useRef<HTMLVideoElement | null>(null);

  // HTML Export copy feedback
  const [copiedHtml, setCopiedHtml] = useState(false);

  const t = COPY[lang];

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('snaptok_dark', String(darkMode));
  }, [darkMode]);

  const detectedUrl = useMemo(() => extractCleanUrlClient(rawInput), [rawInput]);

  const triggerBrowserDownload = (url: string, filename?: string) => {
    const link = document.createElement('a');
    link.href = url;
    if (filename) link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resolveMediaUrl = async (inputString: string): Promise<ResolvedMedia> => {
    const response = await fetch('/api/media/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: inputString }),
    });

    const payload = (await response.json()) as Partial<ResolvedMedia> & { error?: string };
    if (!response.ok || !payload.token) {
      throw new Error(payload.error || 'Could not resolve this media link.');
    }

    return {
      token: payload.token,
      platform: payload.platform || 'video',
      extractedUrl: payload.extractedUrl || inputString,
      title: payload.title || 'Downloaded Video',
      authorHandle: payload.authorHandle || '@creator',
      authorName: payload.authorName || 'Creator',
      duration: payload.duration || 0,
      thumbnailUrl: payload.thumbnailUrl || null,
      previewUrl: payload.previewUrl || null,
      options: payload.options || [],
    };
  };

  const handlePaste = async () => {
    setErrorMsg(null);
    try {
      const txt = await navigator.clipboard.readText();
      if (txt.trim()) setRawInput(txt.trim());
    } catch {
      document.getElementById('media-url-input')?.focus();
    }
  };

  const handleFetchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawInput.trim()) {
      setErrorMsg(t.emptyError);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const resolved = await resolveMediaUrl(rawInput);
      setCurrentMedia(resolved);
      setFormatFilter('video');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to resolve media link.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadOption = (media: ResolvedMedia, opt: StreamOption) => {
    const dlUrl = `/api/media/download?token=${encodeURIComponent(media.token)}&optionId=${encodeURIComponent(opt.id)}`;
    triggerBrowserDownload(dlUrl);

    setSavedFiles((prev) => [
      {
        id: `${media.token}-${opt.id}-${Date.now()}`,
        token: media.token,
        platform: media.platform,
        title: media.title,
        author: media.authorHandle,
        quality: opt.quality,
        container: opt.container,
        sizeBytes: opt.sizeBytes,
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        downloadUrl: dlUrl,
        previewUrl: media.previewUrl,
      },
      ...prev,
    ]);
  };

  const openInFloatingPlayer = async (media: ActivePlayerMedia, requestNativePip = false) => {
    setPlayerMedia(media);
    setTimeout(async () => {
      const el = videoPlayerRef.current;
      if (!el) return;
      try {
        await el.play();
        if (requestNativePip && document.pictureInPictureEnabled && el.requestPictureInPicture) {
          await el.requestPictureInPicture();
        }
      } catch {
        // User interaction or browser policy fallback
      }
    }, 120);
  };

  const handleAddSingleToBatch = () => {
    if (!rawInput.trim()) return;
    const preview = extractCleanUrlClient(rawInput) || rawInput.trim();
    setBatchQueue((prev) => [
      ...prev,
      {
        id: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        rawInput: rawInput.trim(),
        extractedPreview: preview,
        status: 'queued',
      },
    ]);
    setRawInput('');
  };

  const handleQueueBatchLines = () => {
    const lines = batchText
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    const newItems: BatchItem[] = lines.map((line, i) => ({
      id: `batch-${Date.now()}-${i}`,
      rawInput: line,
      extractedPreview: extractCleanUrlClient(line) || line,
      status: 'queued',
    }));
    setBatchQueue((prev) => [...prev, ...newItems]);
    setBatchText('');
  };

  const handleRunBatchQueue = async () => {
    if (batchQueue.length === 0 || batchRunning) return;
    setBatchRunning(true);

    for (const item of batchQueue) {
      if (item.status === 'done') continue;
      setBatchQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: 'fetching', error: undefined } : q))
      );

      try {
        const resolved = await resolveMediaUrl(item.rawInput);
        const targetOption =
          resolved.options.find(
            (o) =>
              o.quality.toLowerCase() === batchTargetQuality.toLowerCase() ||
              o.container.toLowerCase() === batchTargetQuality.toLowerCase()
          ) || resolved.options[0];

        if (targetOption) {
          handleDownloadOption(resolved, targetOption);
        }

        setBatchQueue((prev) =>
          prev.map((q) =>
            q.id === item.id ? { ...q, status: 'done', title: resolved.title } : q
          )
        );
      } catch (err) {
        setBatchQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: 'error',
                  error: err instanceof Error ? err.message : 'Failed',
                }
              : q
          )
        );
      }
    }

    setBatchRunning(false);
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchError(null);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = (await res.json()) as { results?: SearchResultItem[]; error?: string };
      if (!res.ok) throw new Error(data.error || 'Search failed.');
      setSearchResults(data.results || []);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search error.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleFetchFromSearchItem = async (item: SearchResultItem, autoPlay = false) => {
    setActiveTab('downloader');
    setRawInput(item.url);
    setLoading(true);
    setErrorMsg(null);
    try {
      const resolved = await resolveMediaUrl(item.url);
      setCurrentMedia(resolved);
      if (autoPlay && resolved.previewUrl) {
        openInFloatingPlayer({
          title: resolved.title,
          author: resolved.authorHandle,
          streamUrl: resolved.previewUrl,
          downloadUrl: `/api/media/download?token=${encodeURIComponent(resolved.token)}&optionId=${encodeURIComponent(resolved.options[0]?.id || '')}`,
        });
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not fetch selected video.');
    } finally {
      setLoading(false);
    }
  };

  const handleLocalStatusFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const added: SavedLibraryItem[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file.type.startsWith('video/') && !file.type.startsWith('image/') && !file.type.startsWith('audio/')) {
        continue;
      }
      const objectUrl = URL.createObjectURL(file);
      const ext: 'mp4' | 'mp3' | 'm4a' | 'image' = file.type.startsWith('image/')
        ? 'image'
        : file.type.includes('mp3')
          ? 'mp3'
          : file.type.includes('audio')
            ? 'm4a'
            : 'mp4';

      added.push({
        id: `wa-${Date.now()}-${i}`,
        platform: 'WhatsApp Status',
        title: file.name,
        author: 'Device Storage',
        quality: ext === 'image' ? 'Image' : 'Status',
        container: ext,
        sizeBytes: file.size,
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        downloadUrl: objectUrl,
        previewUrl: file.type.startsWith('video/') ? objectUrl : null,
        isLocalStatus: true,
      });
    }

    if (added.length > 0) {
      setSavedFiles((prev) => [...added, ...prev]);
    }
    e.target.value = '';
  };

  const handleCopyHtmlCode = async () => {
    try {
      await navigator.clipboard.writeText(STANDALONE_HTML_CODE);
      setCopiedHtml(true);
      setTimeout(() => setCopiedHtml(false), 2200);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = STANDALONE_HTML_CODE;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedHtml(true);
      setTimeout(() => setCopiedHtml(false), 2200);
    }
  };

  const handleDownloadHtmlFile = () => {
    const blob = new Blob([STANDALONE_HTML_CODE], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    triggerBrowserDownload(url, 'snaptok-hd.html');
    URL.revokeObjectURL(url);
  };

  const filteredSavedFiles = savedFiles.filter((f) => {
    if (fileFilter === 'video') return f.container === 'mp4';
    if (fileFilter === 'audio') return f.container === 'mp3' || f.container === 'm4a';
    return true;
  });

  const displayedOptions = currentMedia
    ? currentMedia.options.filter((opt) => opt.kind === formatFilter)
    : [];

  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 flex flex-col transition-colors">
      {/* Top Bar Contract: Brand — 4 nav links — 1 primary CTA */}
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <a
            href="#workspace"
            onClick={() => setActiveTab('downloader')}
            className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-zinc-900 dark:text-white whitespace-nowrap shrink-0"
          >
            <span className="w-7 h-7 rounded-full bg-amber-400 flex items-center justify-center text-white">
              <ArrowDownToLine className="w-4 h-4 stroke-[2.5]" />
            </span>
            SnapTok
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-600 dark:text-zinc-400">
            <a
              href="#workspace"
              onClick={() => setActiveTab('downloader')}
              className="hover:text-zinc-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {t.navDownloader}
            </a>
            <a
              href="#workspace"
              onClick={() => setActiveTab('search')}
              className="hover:text-zinc-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {t.navSearch}
            </a>
            <a
              href="#workspace"
              onClick={() => setActiveTab('files')}
              className="hover:text-zinc-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {t.navFiles}
            </a>
            <a
              href="#html-code"
              className="hover:text-zinc-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {t.navCode}
            </a>
          </nav>

          <div className="shrink-0">
            <a
              href="#html-code"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 rounded-full transition-colors whitespace-nowrap shrink-0"
            >
              <Code2 className="w-3.5 h-3.5" />
              {t.navCta}
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Main Workspace Section */}
        <section
          id="workspace"
          className="relative overflow-hidden border-b border-zinc-100 dark:border-zinc-800/80"
        >
          <BackgroundMotif />

          <div className="relative max-w-5xl mx-auto px-6 pt-8 pb-16 sm:pt-12 sm:pb-20">
            {/* Workspace Toolbar: Tabs + Language + Dark Mode */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
              <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200/70 dark:border-zinc-800 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('downloader')}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    activeTab === 'downloader'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
                  {t.tabDownloader}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('search')}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    activeTab === 'search'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <Search className="w-3.5 h-3.5" />
                  {t.tabSearch}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('files')}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    activeTab === 'files'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  {t.tabFiles}
                  {savedFiles.length > 0 && (
                    <span className="tabular-nums text-[11px] opacity-75">
                      ({savedFiles.length})
                    </span>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <div className="inline-flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg border border-zinc-200/70 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setLang('si')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      lang === 'si'
                        ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    සිංහල
                  </button>
                  <button
                    type="button"
                    onClick={() => setLang('en')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      lang === 'en'
                        ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    English
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setDarkMode((prev) => !prev)}
                  aria-label="Toggle dark mode"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {darkMode ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                      {t.lightLabel}
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5" />
                      {t.darkLabel}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* TAB 1: DOWNLOADER & BATCH */}
            {activeTab === 'downloader' && (
              <div>
                <div className="text-center">
                  <h1
                    className="font-extrabold tracking-tight text-zinc-900 dark:text-white mx-auto max-w-3xl"
                    style={{
                      fontSize: 'clamp(2.1rem, 3.8vw, 3.35rem)',
                      lineHeight: 1.14,
                      textWrap: 'balance',
                    }}
                  >
                    {t.headline}
                  </h1>
                  <p className="mt-4 text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                    {t.subheadline}
                  </p>
                  <p className="mt-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {SUPPORTED_PLATFORMS.join(' · ')}
                  </p>
                </div>

                {/* Main Link Input Form (type="text" so raw TikTok Lite share messages work) */}
                <form
                  onSubmit={handleFetchSubmit}
                  className="mt-8 max-w-3xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-2 focus-within:border-zinc-400 dark:focus-within:border-zinc-600 transition-colors"
                >
                  <input
                    id="media-url-input"
                    type="text"
                    value={rawInput}
                    onChange={(e) => setRawInput(e.target.value)}
                    placeholder={t.inputPlaceholder}
                    aria-label="Video URL or share text"
                    className="flex-1 bg-transparent px-4 py-3 text-sm sm:text-base text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none min-w-0"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handlePaste}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-3 text-xs sm:text-sm font-semibold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <ClipboardPaste className="w-4 h-4" />
                      {t.pasteBtn}
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-7 py-3 text-sm sm:text-base font-bold text-white bg-[#FF5500] hover:bg-[#E04800] disabled:opacity-60 rounded-full shadow-md shadow-[#FF5500]/20 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {t.fetchingBtn}
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          {t.fetchBtn}
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Quick Actions Row below input */}
                <div className="mt-3 max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setRawInput(TIKTOK_LITE_SAMPLE)}
                      className="underline decoration-zinc-300 dark:decoration-zinc-700 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                    >
                      {t.sampleBtn}
                    </button>
                    {rawInput.trim() && (
                      <button
                        type="button"
                        onClick={handleAddSingleToBatch}
                        className="inline-flex items-center gap-1 font-semibold text-[#FF5500] hover:underline cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {t.addToBatchBtn}
                      </button>
                    )}
                  </div>

                  {detectedUrl && rawInput.trim() !== detectedUrl && (
                    <span className="truncate max-w-md font-mono text-[11px] text-zinc-600 dark:text-zinc-300">
                      {t.extractedLabel}: {detectedUrl}
                    </span>
                  )}
                </div>

                {/* Error Alert */}
                {errorMsg && (
                  <div
                    role="alert"
                    className="mt-5 max-w-3xl mx-auto rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300"
                  >
                    {errorMsg}
                  </div>
                )}

                {/* Resolved Media Result Card */}
                {currentMedia && (
                  <div className="mt-8 max-w-3xl mx-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row gap-6 items-start">
                      <div className="w-full sm:w-44 h-56 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0 flex items-center justify-center">
                        {currentMedia.thumbnailUrl && !brokenThumbs[currentMedia.token] ? (
                          <img
                            src={currentMedia.thumbnailUrl}
                            alt={currentMedia.title}
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setBrokenThumbs((prev) => ({
                                ...prev,
                                [currentMedia.token]: true,
                              }))
                            }
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-zinc-400 p-4 text-center">
                            <Film className="w-8 h-8" />
                            <span className="text-xs font-medium uppercase">
                              {currentMedia.platform}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 w-full">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 tabular-nums">
                          <span className="uppercase font-bold text-[#FF5500]">
                            {currentMedia.platform}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-zinc-800 dark:text-zinc-200 font-semibold">
                            {currentMedia.authorHandle}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{formatDuration(currentMedia.duration)}</span>
                        </div>

                        <h2 className="mt-2 text-lg font-bold text-zinc-900 dark:text-white leading-snug line-clamp-2">
                          {currentMedia.title}
                        </h2>

                        {/* Built-in Player & Floating PiP Launchers */}
                        {currentMedia.previewUrl && (
                          <div className="mt-4 flex flex-wrap items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() =>
                                openInFloatingPlayer({
                                  title: currentMedia.title,
                                  author: currentMedia.authorHandle,
                                  streamUrl: currentMedia.previewUrl!,
                                  downloadUrl: `/api/media/download?token=${encodeURIComponent(currentMedia.token)}&optionId=${encodeURIComponent(currentMedia.options[0]?.id || '')}`,
                                })
                              }
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5" />
                              {t.playInAppBtn}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                openInFloatingPlayer(
                                  {
                                    title: currentMedia.title,
                                    author: currentMedia.authorHandle,
                                    streamUrl: currentMedia.previewUrl!,
                                    downloadUrl: `/api/media/download?token=${encodeURIComponent(currentMedia.token)}&optionId=${encodeURIComponent(currentMedia.options[0]?.id || '')}`,
                                  },
                                  true
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                            >
                              <PictureInPicture2 className="w-3.5 h-3.5" />
                              {t.floatingPipBtn}
                            </button>
                          </div>
                        )}

                        {/* Format Type Switch (Video Resolutions vs MP3/M4A Audio) */}
                        <div className="mt-6">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                              {t.chooseQualityTitle}
                            </span>
                            <div className="inline-flex items-center gap-1 p-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                              <button
                                type="button"
                                onClick={() => setFormatFilter('video')}
                                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                                  formatFilter === 'video'
                                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs'
                                    : 'text-zinc-600 dark:text-zinc-400'
                                }`}
                              >
                                {t.videoTab}
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormatFilter('audio')}
                                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                                  formatFilter === 'audio'
                                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-xs'
                                    : 'text-zinc-600 dark:text-zinc-400'
                                }`}
                              >
                                {t.audioTab}
                              </button>
                            </div>
                          </div>

                          <div className="grid sm:grid-cols-2 gap-2.5">
                            {displayedOptions.map((opt, idx) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => handleDownloadOption(currentMedia, opt)}
                                className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-left transition-colors cursor-pointer ${
                                  idx === 0
                                    ? 'bg-[#FF5500] hover:bg-[#E04800] text-white font-bold'
                                    : 'border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/70 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold'
                                }`}
                              >
                                <span className="inline-flex items-center gap-2 text-xs sm:text-sm truncate">
                                  {opt.kind === 'audio' ? (
                                    <Music className="w-4 h-4 shrink-0" />
                                  ) : (
                                    <Film className="w-4 h-4 shrink-0" />
                                  )}
                                  {opt.label}
                                </span>
                                <span
                                  className={`text-[11px] tabular-nums shrink-0 ${
                                    idx === 0
                                      ? 'text-white/90'
                                      : 'text-zinc-500 dark:text-zinc-400'
                                  }`}
                                >
                                  {opt.sizeBytes > 0
                                    ? formatBytes(opt.sizeBytes)
                                    : opt.container.toUpperCase()}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Batch Download Queue Panel */}
                <div className="mt-12 max-w-3xl mx-auto pt-10 border-t border-zinc-200/80 dark:border-zinc-800">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                        <Layers className="w-4 h-4 text-[#FF5500]" />
                        {t.batchTitle}
                      </h2>
                      <p className="mt-1 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
                        {t.batchSubtitle}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-zinc-500 dark:text-zinc-400">{t.batchQualityLabel}</span>
                      <select
                        value={batchTargetQuality}
                        onChange={(e) => setBatchTargetQuality(e.target.value)}
                        className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-semibold"
                      >
                        <option value="2160p">4K Ultra HD</option>
                        <option value="1080p">1080p Full HD</option>
                        <option value="720p">720p HD</option>
                        <option value="360p">360p Standard</option>
                        <option value="144p">144p Data Saver</option>
                        <option value="MP3">MP3 Audio</option>
                        <option value="M4A">M4A Audio</option>
                      </select>
                    </div>
                  </div>

                  <textarea
                    rows={3}
                    value={batchText}
                    onChange={(e) => setBatchText(e.target.value)}
                    placeholder={t.batchTextareaPlaceholder}
                    className="mt-4 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-3.5 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400"
                  />

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleQueueBatchLines}
                      className="px-4 py-2 rounded-full border border-zinc-300 dark:border-zinc-700 text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      {t.batchAddLinesBtn}
                    </button>
                    {batchQueue.length > 0 && (
                      <>
                        <button
                          type="button"
                          disabled={batchRunning}
                          onClick={handleRunBatchQueue}
                          className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold disabled:opacity-50 cursor-pointer"
                        >
                          {batchRunning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          {t.batchStartBtn} ({batchQueue.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setBatchQueue([])}
                          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                        >
                          {t.batchClearBtn}
                        </button>
                      </>
                    )}
                  </div>

                  {batchQueue.length > 0 && (
                    <div className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900">
                      {batchQueue.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-4 px-4 py-3 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                              {item.title || item.extractedPreview}
                            </p>
                            {item.error && <p className="text-red-600 dark:text-red-400">{item.error}</p>}
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-mono uppercase text-[11px] text-zinc-500 dark:text-zinc-400">
                              {item.status}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setBatchQueue((prev) => prev.filter((q) => q.id !== item.id))
                              }
                              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: BUILT-IN SEARCH & BROWSER */}
            {activeTab === 'search' && (
              <div className="max-w-4xl mx-auto">
                <div className="text-center">
                  <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                    {t.searchTitle}
                  </h1>
                  <p className="mt-3 text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
                    {t.searchSubtitle}
                  </p>
                </div>

                <form
                  onSubmit={handleSearchSubmit}
                  className="mt-8 flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-2"
                >
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t.searchPlaceholder}
                    className="flex-1 bg-transparent px-4 py-2.5 text-sm text-zinc-900 dark:text-white focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={searchLoading}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#FF5500] hover:bg-[#E04800] text-white text-sm font-bold cursor-pointer"
                  >
                    {searchLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    {t.searchBtn}
                  </button>
                </form>

                {/* Quick Platform Launcher */}
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs">
                  <span className="text-zinc-500 dark:text-zinc-400 mr-1">{t.quickSitesLabel}</span>
                  {[
                    { name: 'TikTok', href: 'https://www.tiktok.com' },
                    { name: 'YouTube', href: 'https://www.youtube.com' },
                    { name: 'Facebook', href: 'https://www.facebook.com' },
                    { name: 'Instagram', href: 'https://www.instagram.com' },
                    { name: 'X (Twitter)', href: 'https://x.com' },
                    { name: 'Vimeo', href: 'https://vimeo.com' },
                    { name: 'Dailymotion', href: 'https://www.dailymotion.com' },
                  ].map((site) => (
                    <a
                      key={site.name}
                      href={site.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 transition-colors"
                    >
                      <Globe className="w-3 h-3" />
                      {site.name}
                      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                    </a>
                  ))}
                </div>

                {searchError && (
                  <p className="mt-4 text-center text-sm text-red-600 dark:text-red-400">
                    {searchError}
                  </p>
                )}

                {searchResults.length > 0 && (
                  <div className="mt-8 grid sm:grid-cols-2 gap-4">
                    {searchResults.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden flex flex-col"
                      >
                        <div className="h-44 bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                          {item.thumbnailUrl ? (
                            <img
                              src={item.thumbnailUrl}
                              alt={item.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-400">
                              <Film className="w-8 h-8" />
                            </div>
                          )}
                        </div>
                        <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                          <div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                              {item.platform} · {item.author} · {item.durationLabel}
                            </div>
                            <h3 className="mt-1.5 text-sm font-bold text-zinc-900 dark:text-white line-clamp-2">
                              {item.title}
                            </h3>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleFetchFromSearchItem(item, true)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold cursor-pointer"
                            >
                              <Play className="w-3 h-3" />
                              {t.playInAppBtn}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFetchFromSearchItem(item, false)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#FF5500] text-white text-xs font-bold cursor-pointer"
                            >
                              <Download className="w-3 h-3" />
                              HD / MP3
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setBatchQueue((prev) => [
                                  ...prev,
                                  {
                                    id: `search-q-${Date.now()}`,
                                    rawInput: item.url,
                                    extractedPreview: item.url,
                                    status: 'queued',
                                    title: item.title,
                                  },
                                ]);
                              }}
                              className="px-3 py-2 rounded-full border border-zinc-300 dark:border-zinc-700 text-xs font-semibold cursor-pointer"
                            >
                              + Batch
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: FILE MANAGER & WHATSAPP STATUS SAVER */}
            {activeTab === 'files' && (
              <div className="max-w-4xl mx-auto">
                <div className="text-center">
                  <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white">
                    {t.filesTitle}
                  </h1>
                  <p className="mt-3 text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
                    {t.filesSubtitle}
                  </p>
                </div>

                {/* WhatsApp Status Local Picker Card */}
                <div className="mt-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-zinc-900 dark:text-white">
                      {t.waStatusTitle}
                    </h2>
                    <p className="mt-1 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
                      {t.waStatusDesc}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <label className="px-4 py-2.5 rounded-full bg-[#FF5500] hover:bg-[#E04800] text-white text-xs font-bold cursor-pointer whitespace-nowrap">
                      {t.waPickFilesBtn}
                      <input
                        type="file"
                        multiple
                        accept="video/*,image/*,audio/*"
                        onChange={handleLocalStatusFilesSelected}
                        className="hidden"
                      />
                    </label>
                    <label className="px-4 py-2.5 rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold cursor-pointer whitespace-nowrap">
                      {t.waPickFolderBtn}
                      <input
                        type="file"
                        webkitdirectory=""
                        multiple
                        onChange={handleLocalStatusFilesSelected}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Filter Tabs */}
                <div className="mt-8 flex items-center justify-between gap-4">
                  <div className="inline-flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-lg">
                    {(['all', 'video', 'audio'] as const).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFileFilter(key)}
                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                          fileFilter === key
                            ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                            : 'text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        {key === 'all'
                          ? t.filterAll
                          : key === 'video'
                            ? t.filterVideo
                            : t.filterAudio}
                      </button>
                    ))}
                  </div>
                  {savedFiles.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSavedFiles([])}
                      className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t.batchClearBtn}
                    </button>
                  )}
                </div>

                {filteredSavedFiles.length === 0 ? (
                  <div className="mt-6 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 p-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    {t.emptyLibrary}
                  </div>
                ) : (
                  <div className="mt-4 divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900">
                    {filteredSavedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                            {file.title}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                            {file.platform} · {file.quality} · {file.container.toUpperCase()} ·{' '}
                            {formatBytes(file.sizeBytes)} · {file.createdAt}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {file.previewUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                openInFloatingPlayer({
                                  title: file.title,
                                  author: file.author,
                                  streamUrl: file.previewUrl!,
                                  downloadUrl: file.downloadUrl,
                                })
                              }
                              className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full border border-zinc-300 dark:border-zinc-700 text-xs font-semibold cursor-pointer"
                            >
                              <Play className="w-3 h-3" />
                              Play
                            </button>
                          )}
                          {file.downloadUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                triggerBrowserDownload(
                                  file.downloadUrl!,
                                  file.isLocalStatus ? file.title : undefined
                                )
                              }
                              className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold cursor-pointer"
                            >
                              <Download className="w-3 h-3" />
                              Save
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setSavedFiles((prev) => prev.filter((item) => item.id !== file.id))
                            }
                            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Step-by-Step Guide (Echoing Snaptube Screenshot) */}
        <section
          id="how-to-save"
          className="max-w-5xl mx-auto px-6 py-16 border-b border-zinc-100 dark:border-zinc-800/80"
        >
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {t.stepsHeading}
          </h2>

          <div className="mt-10 grid md:grid-cols-2 gap-10">
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{t.step1Title}</h3>
              <ol className="mt-4 space-y-3 text-sm sm:text-base text-zinc-600 dark:text-zinc-400 tabular-nums">
                {t.step1Items.map((line, index) => (
                  <li key={line} className="flex items-start gap-3">
                    <span className="font-bold text-zinc-900 dark:text-white shrink-0">
                      {index + 1}.
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{t.step2Title}</h3>
              <ol className="mt-4 space-y-3 text-sm sm:text-base text-zinc-600 dark:text-zinc-400 tabular-nums">
                {t.step2Items.map((line, index) => (
                  <li key={line} className="flex items-start gap-3">
                    <span className="font-bold text-zinc-900 dark:text-white shrink-0">
                      {index + 1}.
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Standalone HTML Code Export Section */}
        <section id="html-code" className="max-w-5xl mx-auto px-6 py-16">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
                {t.codeHeading}
              </h2>
              <p className="mt-2 text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-2xl">
                {t.codeSubheading}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={handleCopyHtmlCode}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {copiedHtml ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    {t.copiedCodeBtn}
                  </>
                ) : (
                  <>
                    <Code2 className="w-4 h-4" />
                    {t.copyCodeBtn}
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownloadHtmlFile}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#FF5500] hover:bg-[#E04800] text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <FileCode className="w-4 h-4" />
                {t.downloadHtmlBtn}
              </button>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 text-zinc-100 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 text-xs font-mono text-zinc-400">
              <span>snaptok-hd.html</span>
              <span className="tabular-nums">
                {STANDALONE_HTML_CODE.split('\n').length} lines
              </span>
            </div>
            <pre className="p-4 sm:p-5 text-xs font-mono leading-relaxed overflow-x-auto max-h-96 overflow-y-auto text-zinc-200">
              <code>{STANDALONE_HTML_CODE}</code>
            </pre>
          </div>
        </section>
      </main>

      {/* Floating Mini Player (Picture-in-Picture) */}
      {playerMedia && (
        <div className="fixed bottom-4 right-4 z-40 w-80 sm:w-96 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-950 text-white shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-zinc-800">
            <div className="min-w-0">
              <p className="text-xs font-bold truncate">{playerMedia.title}</p>
              <p className="text-[11px] text-zinc-400 truncate">{playerMedia.author}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                title="Picture-in-Picture"
                onClick={async () => {
                  const el = videoPlayerRef.current;
                  if (el && document.pictureInPictureEnabled && el.requestPictureInPicture) {
                    await el.requestPictureInPicture().catch(() => {});
                  }
                }}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="Close player"
                onClick={() => {
                  videoPlayerRef.current?.pause();
                  setPlayerMedia(null);
                }}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <video
            ref={videoPlayerRef}
            src={playerMedia.streamUrl}
            controls
            playsInline
            className="w-full max-h-56 bg-black"
          />

          {playerMedia.downloadUrl && (
            <div className="px-3.5 py-2 bg-zinc-900 flex items-center justify-between text-xs">
              <span className="text-zinc-400">Floating Player</span>
              <button
                type="button"
                onClick={() => triggerBrowserDownload(playerMedia.downloadUrl!)}
                className="font-semibold text-[#FF5500] hover:underline cursor-pointer"
              >
                Download File
              </button>
            </div>
          )}
        </div>
      )}

      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <span className="font-bold text-zinc-900 dark:text-white">SnapTok</span>
          <span>{t.footerText}</span>
        </div>
      </footer>
    </div>
  );
}
