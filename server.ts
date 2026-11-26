import express, { type Request, type Response } from 'express';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

type SupportedPlatform =
  | 'tiktok'
  | 'youtube'
  | 'facebook'
  | 'instagram'
  | 'twitter'
  | 'vimeo'
  | 'dailymotion';

interface MediaStreamOption {
  id: string;
  label: string;
  quality: string;
  height: number;
  container: 'mp4' | 'mp3' | 'm4a';
  kind: 'video' | 'audio';
  sizeBytes: number;
  url: string;
  audioMuxUrl?: string | null;
  requiresFfmpegScale?: boolean;
  requiresFfmpegAudio?: boolean;
}

interface CachedMediaEntry {
  createdAt: number;
  platform: SupportedPlatform;
  sourceUrl: string;
  title: string;
  authorHandle: string;
  authorName: string;
  duration: number;
  coverUrl: string | null;
  previewUrl: string | null;
  options: MediaStreamOption[];
  cookies?: string;
}

const mediaCache = new Map<string, CachedMediaEntry>();
const CACHE_TTL_MS = 45 * 60 * 1000;

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const PLATFORM_HOSTS: Record<SupportedPlatform, string[]> = {
  tiktok: ['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com', 'v.tiktok.com', 'm.tiktok.com'],
  youtube: ['youtube.com', 'youtu.be', 'm.youtube.com', 'music.youtube.com'],
  facebook: ['facebook.com', 'm.facebook.com', 'web.facebook.com', 'fb.watch'],
  instagram: ['instagram.com'],
  twitter: ['x.com', 'twitter.com', 'mobile.twitter.com', 't.co'],
  vimeo: ['vimeo.com', 'player.vimeo.com'],
  dailymotion: ['dailymotion.com', 'dai.ly'],
};

function cleanupExpiredCache() {
  const now = Date.now();
  for (const [key, entry] of mediaCache.entries()) {
    if (now - entry.createdAt > CACHE_TTL_MS) {
      mediaCache.delete(key);
    }
  }
}

function isPrivateOrLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal')
  ) {
    return true;
  }

  const ipVersion = net.isIP(normalized);
  if (ipVersion === 4) {
    const parts = normalized.split('.').map(Number);
    if (parts.length !== 4) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  if (ipVersion === 6) {
    if (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fe80:') ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd')
    ) {
      return true;
    }
    return false;
  }

  return false;
}

function validateSafeHttpUrl(rawUrl: string): URL | null {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    if (parsed.username || parsed.password) {
      return null;
    }
    if (isPrivateOrLocalHostname(parsed.hostname)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function detectPlatformFromUrl(url: URL): SupportedPlatform | null {
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  for (const [platform, domains] of Object.entries(PLATFORM_HOSTS) as Array<
    [SupportedPlatform, string[]]
  >) {
    for (const domain of domains) {
      if (host === domain || host.endsWith(`.${domain}`)) {
        return platform;
      }
    }
  }
  return null;
}

function isPromoAppLink(url: URL): boolean {
  const full = url.toString().toLowerCase();
  return (
    full.includes('tiktok.com/tiktoklite') ||
    full.includes('tiktok.com/download') ||
    full.includes('play.google.com') ||
    full.includes('apps.apple.com')
  );
}

/**
 * Extracts the actual social/video URL from messy share text such as:
 * "https://vm.tiktok.com/ZSshAJnxm/ This post is shared via TikTok Lite. Download TikTok Lite to enjoy more posts: https://www.tiktok.com/tiktoklite"
 */
function extractPlatformUrlFromText(rawInput: string): {
  url: URL;
  platform: SupportedPlatform;
} | null {
  const matches = rawInput.match(/https?:\/\/[^\s"'<>]+/gi) || [];
  const candidates: Array<{ url: URL; platform: SupportedPlatform; score: number }> = [];

  for (const rawCandidate of matches) {
    const cleaned = rawCandidate.replace(/[.,!?;:)\]]+$/, '');
    const parsed = validateSafeHttpUrl(cleaned);
    if (!parsed) continue;
    const platform = detectPlatformFromUrl(parsed);
    if (!platform) continue;
    if (isPromoAppLink(parsed)) continue;

    let score = 10;
    const pathLower = parsed.pathname.toLowerCase();
    if (
      parsed.hostname.includes('vm.tiktok.com') ||
      parsed.hostname.includes('vt.tiktok.com') ||
      pathLower.includes('/video/') ||
      pathLower.includes('/reel') ||
      pathLower.includes('/watch') ||
      pathLower.includes('/shorts/') ||
      pathLower.includes('/status/') ||
      parsed.searchParams.has('v')
    ) {
      score += 20;
    }
    if (pathLower === '/' || pathLower === '') {
      score -= 5;
    }

    candidates.push({ url: parsed, platform, score });
  }

  if (candidates.length === 0) {
    // Try treating the trimmed string as a bare domain URL
    const trimmed = rawInput.trim();
    if (trimmed && !trimmed.includes(' ')) {
      const parsed = validateSafeHttpUrl(
        trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
      );
      if (parsed) {
        const platform = detectPlatformFromUrl(parsed);
        if (platform && !isPromoAppLink(parsed)) {
          return { url: parsed, platform };
        }
      }
    }
    return null;
  }

  candidates.sort((a, b) => b.score - a.score);
  return { url: candidates[0].url, platform: candidates[0].platform };
}

function normalizeMediaUrl(maybeRelative: unknown, base: string): string | null {
  if (typeof maybeRelative !== 'string' || !maybeRelative.trim()) {
    return null;
  }
  try {
    const resolved = new URL(maybeRelative, base).toString();
    const valid = validateSafeHttpUrl(resolved);
    return valid ? valid.toString() : null;
  } catch {
    return null;
  }
}

async function resolveShortRedirects(initialUrl: URL): Promise<URL> {
  let current = initialUrl;
  for (let hop = 0; hop < 4; hop++) {
    const host = current.hostname.toLowerCase();
    const isShortener =
      host === 'vm.tiktok.com' ||
      host === 'vt.tiktok.com' ||
      host === 'v.tiktok.com' ||
      host === 'fb.watch' ||
      host === 't.co' ||
      host === 'dai.ly';
    if (!isShortener) {
      return current;
    }

    const res = await fetch(current.toString(), {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': BROWSER_UA },
      signal: AbortSignal.timeout(8000),
    });

    const location = res.headers.get('location');
    if (res.body) {
      res.body.cancel().catch(() => {});
    }
    if (!location) {
      return current;
    }

    const nextUrl = new URL(location, current.toString());
    const validNext = validateSafeHttpUrl(nextUrl.toString());
    if (!validNext || !detectPlatformFromUrl(validNext)) {
      return current;
    }
    current = validNext;
  }
  return current;
}

function buildStandardResolutionOptions(
  baseMp4Url: string,
  audioSourceUrl: string | null,
  nativeOptions: MediaStreamOption[]
): MediaStreamOption[] {
  const result: MediaStreamOption[] = [...nativeOptions];
  const existingHeights = new Set(
    nativeOptions.filter((o) => o.kind === 'video').map((o) => o.height)
  );

  // Determine highest native height so we don't upscale fake 4K from a 720p source
  const maxNativeHeight = Math.max(
    ...nativeOptions.filter((o) => o.kind === 'video').map((o) => o.height || 720),
    720
  );

  const targets = [
    { height: 2160, label: '4K Ultra HD', quality: '2160p' },
    { height: 1080, label: '1080p Full HD', quality: '1080p' },
    { height: 720, label: '720p HD', quality: '720p' },
    { height: 360, label: '360p Standard', quality: '360p' },
    { height: 144, label: '144p Data Saver', quality: '144p' },
  ];

  for (const target of targets) {
    if (target.height <= maxNativeHeight && !existingHeights.has(target.height)) {
      result.push({
        id: `mp4-${target.height}p`,
        label: target.label,
        quality: target.quality,
        height: target.height,
        container: 'mp4',
        kind: 'video',
        sizeBytes: 0,
        url: baseMp4Url,
        requiresFfmpegScale: true,
      });
    }
  }

  // Sort video options highest resolution first
  const videoOpts = result
    .filter((o) => o.kind === 'video')
    .sort((a, b) => b.height - a.height);

  // Audio options (MP3 & M4A)
  const audioOpts: MediaStreamOption[] = [];
  const existingContainers = new Set(
    result.filter((o) => o.kind === 'audio').map((o) => o.container)
  );

  const existingAudio = result.filter((o) => o.kind === 'audio');
  audioOpts.push(...existingAudio);

  const audioFeed = audioSourceUrl || baseMp4Url;
  if (!existingContainers.has('mp3')) {
    audioOpts.push({
      id: 'audio-mp3',
      label: 'MP3 Audio (192kbps)',
      quality: 'MP3',
      height: 0,
      container: 'mp3',
      kind: 'audio',
      sizeBytes: 0,
      url: audioFeed,
      requiresFfmpegAudio: true,
    });
  }
  if (!existingContainers.has('m4a')) {
    audioOpts.push({
      id: 'audio-m4a',
      label: 'M4A Audio (AAC)',
      quality: 'M4A',
      height: 0,
      container: 'm4a',
      kind: 'audio',
      sizeBytes: 0,
      url: audioFeed,
      requiresFfmpegAudio: true,
    });
  }

  return [...videoOpts, ...audioOpts];
}

async function resolveTikTok(originalUrl: URL, canonicalUrl: URL): Promise<CachedMediaEntry | null> {
  const candidates = [canonicalUrl.toString(), originalUrl.toString()];

  for (const target of candidates) {
    try {
      const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(target)}&hd=1`;
      const response = await fetch(apiUrl, {
        headers: { Accept: 'application/json', 'User-Agent': BROWSER_UA },
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) continue;

      const payload = (await response.json()) as {
        code?: number;
        data?: {
          title?: string;
          cover?: string;
          origin_cover?: string;
          duration?: number;
          play?: string;
          wmplay?: string;
          hdplay?: string;
          music?: string;
          size?: number;
          hd_size?: number;
          author?: { unique_id?: string; nickname?: string };
        };
      };

      if (payload.code === 0 && payload.data) {
        const d = payload.data;
        const base = 'https://www.tikwm.com';
        const hdUrl = normalizeMediaUrl(d.hdplay, base);
        const sdUrl = normalizeMediaUrl(d.play || d.wmplay, base);
        const audioUrl = normalizeMediaUrl(d.music, base);
        const coverUrl = normalizeMediaUrl(d.cover || d.origin_cover, base);
        const bestMp4 = hdUrl || sdUrl;

        if (!bestMp4) continue;

        const native: MediaStreamOption[] = [];
        if (hdUrl) {
          native.push({
            id: 'mp4-1080p',
            label: '1080p Full HD (No Watermark)',
            quality: '1080p',
            height: 1080,
            container: 'mp4',
            kind: 'video',
            sizeBytes: Number(d.hd_size || 0),
            url: hdUrl,
          });
        }
        if (sdUrl) {
          native.push({
            id: hdUrl ? 'mp4-720p' : 'mp4-540p',
            label: hdUrl ? '720p HD (No Watermark)' : 'Standard MP4',
            quality: hdUrl ? '720p' : '540p',
            height: hdUrl ? 720 : 540,
            container: 'mp4',
            kind: 'video',
            sizeBytes: Number(d.size || 0),
            url: sdUrl,
          });
        }
        if (audioUrl) {
          native.push({
            id: 'audio-mp3',
            label: 'MP3 Audio (Original)',
            quality: 'MP3',
            height: 0,
            container: 'mp3',
            kind: 'audio',
            sizeBytes: 0,
            url: audioUrl,
          });
        }

        return {
          createdAt: Date.now(),
          platform: 'tiktok',
          sourceUrl: originalUrl.toString(),
          title: (d.title || 'TikTok Video').trim(),
          authorHandle: d.author?.unique_id ? `@${d.author.unique_id}` : '@tiktok_creator',
          authorName: d.author?.nickname || 'TikTok Creator',
          duration: Number(d.duration || 0),
          coverUrl,
          previewUrl: bestMp4,
          options: buildStandardResolutionOptions(bestMp4, audioUrl, native),
        };
      }
    } catch {
      // Try next candidate
    }
  }

  // Fallback: direct TikTok HTML parse
  try {
    const res = await fetch(canonicalUrl.toString(), {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const cookies = (res.headers.get('set-cookie') || '')
      .split(',')
      .map((p) => p.split(';')[0]?.trim())
      .filter(Boolean)
      .join('; ');
    const html = await res.text();
    const match = html.match(
      /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/
    );
    if (!match?.[1]) return null;
    const json = JSON.parse(match[1]) as Record<string, unknown>;
    const scope = json['__DEFAULT_SCOPE__'] as Record<string, unknown> | undefined;
    const detail = scope?.['webapp.video-detail'] as Record<string, unknown> | undefined;
    const itemInfo = detail?.['itemInfo'] as Record<string, unknown> | undefined;
    const item = itemInfo?.['itemStruct'] as Record<string, unknown> | undefined;
    if (!item) return null;

    const video = item['video'] as Record<string, unknown> | undefined;
    const author = item['author'] as Record<string, unknown> | undefined;
    const music = item['music'] as Record<string, unknown> | undefined;
    const bitrateInfo = Array.isArray(video?.['bitrateInfo'])
      ? (video['bitrateInfo'] as Array<{
          Bitrate?: number;
          PlayAddr?: { UrlList?: string[]; DataSize?: number; Height?: number };
        }>)
      : [];

    const sorted = [...bitrateInfo].sort((a, b) => (b.Bitrate || 0) - (a.Bitrate || 0));
    const best = sorted[0]?.PlayAddr?.UrlList?.find((u) => validateSafeHttpUrl(u)) || null;
    if (!best) return null;

    const height = Number(sorted[0]?.PlayAddr?.Height || video?.['height'] || 1080);
    const native: MediaStreamOption[] = [
      {
        id: `mp4-${height}p`,
        label: `${height >= 1080 ? '1080p Full HD' : `${height}p HD`}`,
        quality: `${height}p`,
        height,
        container: 'mp4',
        kind: 'video',
        sizeBytes: Number(sorted[0]?.PlayAddr?.DataSize || 0),
        url: best,
      },
    ];
    const audioUrl = normalizeMediaUrl(music?.['playUrl'], canonicalUrl.toString());
    const coverUrl = normalizeMediaUrl(video?.['cover'], canonicalUrl.toString());

    return {
      createdAt: Date.now(),
      platform: 'tiktok',
      sourceUrl: originalUrl.toString(),
      title: typeof item['desc'] === 'string' && item['desc'].trim() ? item['desc'] : 'TikTok Video',
      authorHandle:
        typeof author?.['uniqueId'] === 'string' ? `@${author['uniqueId']}` : '@tiktok_creator',
      authorName: typeof author?.['nickname'] === 'string' ? author['nickname'] : 'TikTok Creator',
      duration: Number(video?.['duration'] || 0),
      coverUrl,
      previewUrl: best,
      options: buildStandardResolutionOptions(best, audioUrl, native),
      cookies,
    };
  } catch {
    return null;
  }
}

function extractYouTubeId(url: URL): string | null {
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'youtu.be') {
    return url.pathname.split('/').filter(Boolean)[0] || null;
  }
  if (url.searchParams.has('v')) {
    return url.searchParams.get('v');
  }
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live') {
    return parts[1] || null;
  }
  return null;
}

async function resolveYouTube(url: URL): Promise<CachedMediaEntry | null> {
  const videoId = extractYouTubeId(url);
  if (!videoId) return null;

  try {
    const playerRes = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)',
      },
      body: JSON.stringify({
        videoId,
        context: {
          client: {
            clientName: 'IOS',
            clientVersion: '19.29.1',
            deviceModel: 'iPhone16,2',
            hl: 'en',
            gl: 'US',
          },
        },
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!playerRes.ok) return null;
    const data = (await playerRes.json()) as {
      videoDetails?: {
        title?: string;
        author?: string;
        lengthSeconds?: string;
        thumbnail?: { thumbnails?: Array<{ url?: string }> };
      };
      streamingData?: {
        formats?: Array<{
          url?: string;
          mimeType?: string;
          height?: number;
          qualityLabel?: string;
          contentLength?: string;
        }>;
        adaptiveFormats?: Array<{
          url?: string;
          mimeType?: string;
          height?: number;
          qualityLabel?: string;
          contentLength?: string;
          bitrate?: number;
        }>;
      };
    };

    const streaming = data.streamingData;
    const details = data.videoDetails;
    if (!streaming || !details) return null;

    const muxed = (streaming.formats || []).filter(
      (f) => f.url && validateSafeHttpUrl(f.url) && f.mimeType?.includes('video/mp4')
    );
    const adaptiveVideo = (streaming.adaptiveFormats || []).filter(
      (f) => f.url && validateSafeHttpUrl(f.url) && f.mimeType?.includes('video/mp4')
    );
    const adaptiveAudio = (streaming.adaptiveFormats || [])
      .filter((f) => f.url && validateSafeHttpUrl(f.url) && f.mimeType?.includes('audio/mp4'))
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    const bestAudioUrl = adaptiveAudio[0]?.url || null;
    const native: MediaStreamOption[] = [];
    const seenHeights = new Set<number>();

    // Prefer muxed for direct fast download when matching height, otherwise adaptive + ffmpeg audio mux
    for (const f of muxed) {
      if (!f.height || !f.url || seenHeights.has(f.height)) continue;
      seenHeights.add(f.height);
      native.push({
        id: `mp4-${f.height}p`,
        label: f.qualityLabel || `${f.height}p MP4`,
        quality: `${f.height}p`,
        height: f.height,
        container: 'mp4',
        kind: 'video',
        sizeBytes: Number(f.contentLength || 0),
        url: f.url,
      });
    }

    if (bestAudioUrl) {
      for (const f of adaptiveVideo) {
        if (!f.height || !f.url || seenHeights.has(f.height)) continue;
        if (![2160, 1440, 1080, 720, 480, 360, 240, 144].includes(f.height)) continue;
        seenHeights.add(f.height);
        native.push({
          id: `mp4-${f.height}p`,
          label: `${f.height >= 2160 ? '4K Ultra HD' : f.height === 1080 ? '1080p Full HD' : f.height === 720 ? '720p HD' : `${f.height}p`}`,
          quality: `${f.height}p`,
          height: f.height,
          container: 'mp4',
          kind: 'video',
          sizeBytes: Number(f.contentLength || 0),
          url: f.url,
          audioMuxUrl: bestAudioUrl,
        });
      }
    }

    if (bestAudioUrl) {
      native.push({
        id: 'audio-m4a',
        label: 'M4A Audio (Original)',
        quality: 'M4A',
        height: 0,
        container: 'm4a',
        kind: 'audio',
        sizeBytes: Number(adaptiveAudio[0]?.contentLength || 0),
        url: bestAudioUrl,
      });
    }

    const previewStream = muxed[muxed.length - 1]?.url || native[0]?.url || null;
    if (!previewStream || native.length === 0) return null;

    const thumbs = details.thumbnail?.thumbnails || [];
    const coverUrl = normalizeMediaUrl(thumbs[thumbs.length - 1]?.url, url.toString());

    return {
      createdAt: Date.now(),
      platform: 'youtube',
      sourceUrl: url.toString(),
      title: details.title || 'YouTube Video',
      authorHandle: details.author || 'YouTube Channel',
      authorName: details.author || 'YouTube Channel',
      duration: Number(details.lengthSeconds || 0),
      coverUrl,
      previewUrl: previewStream,
      options: buildStandardResolutionOptions(previewStream, bestAudioUrl, native),
    };
  } catch {
    return null;
  }
}

async function resolveTwitter(url: URL): Promise<CachedMediaEntry | null> {
  const match = url.pathname.match(/\/status\/(\d+)/);
  if (!match?.[1]) return null;
  const tweetId = match[1];

  try {
    const res = await fetch(
      `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=a`,
      { headers: { 'User-Agent': BROWSER_UA }, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      text?: string;
      user?: { name?: string; screen_name?: string };
      mediaDetails?: Array<{
        media_url_https?: string;
        video_info?: {
          duration_millis?: number;
          variants?: Array<{ content_type?: string; bitrate?: number; url?: string }>;
        };
      }>;
    };

    const media = data.mediaDetails?.find((m) => m.video_info?.variants?.length);
    const variants = (media?.video_info?.variants || [])
      .filter((v) => v.content_type === 'video/mp4' && v.url && validateSafeHttpUrl(v.url))
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    if (variants.length === 0 || !variants[0].url) return null;

    const native: MediaStreamOption[] = variants.map((v, idx) => {
      const estimatedHeight = idx === 0 ? 1080 : idx === 1 ? 720 : 360;
      return {
        id: `mp4-${estimatedHeight}p-${idx}`,
        label:
          estimatedHeight === 1080
            ? '1080p HD MP4'
            : estimatedHeight === 720
              ? '720p MP4'
              : '360p MP4',
        quality: `${estimatedHeight}p`,
        height: estimatedHeight,
        container: 'mp4',
        kind: 'video',
        sizeBytes: 0,
        url: v.url as string,
      };
    });

    return {
      createdAt: Date.now(),
      platform: 'twitter',
      sourceUrl: url.toString(),
      title: (data.text || 'X / Twitter Video').slice(0, 120),
      authorHandle: data.user?.screen_name ? `@${data.user.screen_name}` : '@x_user',
      authorName: data.user?.name || 'X Creator',
      duration: Math.round((media?.video_info?.duration_millis || 0) / 1000),
      coverUrl: normalizeMediaUrl(media?.media_url_https, url.toString()),
      previewUrl: variants[0].url,
      options: buildStandardResolutionOptions(variants[0].url, null, native),
    };
  } catch {
    return null;
  }
}

async function resolveVimeo(url: URL): Promise<CachedMediaEntry | null> {
  const match = url.pathname.match(/\/(\d+)/);
  if (!match?.[1]) return null;
  const videoId = match[1];

  try {
    const res = await fetch(`https://player.vimeo.com/video/${videoId}/config`, {
      headers: { 'User-Agent': BROWSER_UA, Referer: 'https://vimeo.com/' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      video?: { title?: string; duration?: number; owner?: { name?: string }; thumbs?: Record<string, string> };
      request?: {
        files?: {
          progressive?: Array<{ url?: string; height?: number; quality?: string; size?: number }>;
        };
      };
    };

    const files = (data.request?.files?.progressive || [])
      .filter((f) => f.url && validateSafeHttpUrl(f.url))
      .sort((a, b) => (b.height || 0) - (a.height || 0));

    if (files.length === 0 || !files[0].url) return null;

    const native: MediaStreamOption[] = files.map((f) => ({
      id: `mp4-${f.height || 720}p`,
      label: `${f.height || 720}p MP4`,
      quality: f.quality || `${f.height || 720}p`,
      height: f.height || 720,
      container: 'mp4',
      kind: 'video',
      sizeBytes: Number(f.size || 0),
      url: f.url as string,
    }));

    const thumbs = Object.values(data.video?.thumbs || {});
    return {
      createdAt: Date.now(),
      platform: 'vimeo',
      sourceUrl: url.toString(),
      title: data.video?.title || 'Vimeo Video',
      authorHandle: data.video?.owner?.name || 'Vimeo Creator',
      authorName: data.video?.owner?.name || 'Vimeo Creator',
      duration: Number(data.video?.duration || 0),
      coverUrl: normalizeMediaUrl(thumbs[thumbs.length - 1], url.toString()),
      previewUrl: files[0].url,
      options: buildStandardResolutionOptions(files[0].url, null, native),
    };
  } catch {
    return null;
  }
}

async function resolveMetaOrGenericOgVideo(
  url: URL,
  platform: SupportedPlatform
): Promise<CachedMediaEntry | null> {
  try {
    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent':
          'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    const extractMeta = (prop: string) => {
      const m = html.match(
        new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i')
      );
      return m?.[1]?.replace(/&amp;/g, '&') || null;
    };

    const hdMatch = html.match(/"playable_url_quality_hd":"([^"]+)"/);
    const sdMatch = html.match(/"playable_url":"([^"]+)"/);
    const decodeEscaped = (raw: string | undefined) =>
      raw ? raw.replace(/\\\//g, '/').replace(/\\u0025/g, '%') : null;

    const hdUrl = normalizeMediaUrl(decodeEscaped(hdMatch?.[1]), url.toString());
    const sdUrl =
      normalizeMediaUrl(decodeEscaped(sdMatch?.[1]), url.toString()) ||
      normalizeMediaUrl(extractMeta('og:video:secure_url') || extractMeta('og:video'), url.toString());

    const bestUrl = hdUrl || sdUrl;
    if (!bestUrl) return null;

    const native: MediaStreamOption[] = [];
    if (hdUrl) {
      native.push({
        id: 'mp4-1080p',
        label: '1080p HD MP4',
        quality: '1080p',
        height: 1080,
        container: 'mp4',
        kind: 'video',
        sizeBytes: 0,
        url: hdUrl,
      });
    }
    if (sdUrl) {
      native.push({
        id: 'mp4-720p',
        label: hdUrl ? '720p Standard MP4' : 'HD MP4',
        quality: '720p',
        height: 720,
        container: 'mp4',
        kind: 'video',
        sizeBytes: 0,
        url: sdUrl,
      });
    }

    return {
      createdAt: Date.now(),
      platform,
      sourceUrl: url.toString(),
      title: extractMeta('og:title') || `${platform.toUpperCase()} Video`,
      authorHandle: `@${platform}_creator`,
      authorName: platform.toUpperCase(),
      duration: 0,
      coverUrl: normalizeMediaUrl(extractMeta('og:image'), url.toString()),
      previewUrl: bestUrl,
      options: buildStandardResolutionOptions(bestUrl, null, native),
    };
  } catch {
    return null;
  }
}

async function resolveDailymotion(url: URL): Promise<CachedMediaEntry | null> {
  const pathParts = url.pathname.split('/').filter(Boolean);
  const videoId = pathParts[pathParts.length - 1]?.split('_')[0];
  if (!videoId) return null;

  try {
    const res = await fetch(`https://www.dailymotion.com/player/metadata/video/${videoId}`, {
      headers: { 'User-Agent': BROWSER_UA },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      title?: string;
      duration?: number;
      owner?: { screenname?: string };
      posters?: Record<string, string>;
      qualities?: Record<string, Array<{ type?: string; url?: string }>>;
    };

    const native: MediaStreamOption[] = [];
    let bestUrl: string | null = null;
    const qualityMap: Array<[string, number, string]> = [
      ['1080', 1080, '1080p Full HD'],
      ['720', 720, '720p HD'],
      ['480', 480, '480p'],
      ['380', 360, '360p'],
      ['240', 240, '240p'],
    ];

    for (const [key, height, label] of qualityMap) {
      const mp4 = data.qualities?.[key]?.find(
        (q) => q.type === 'video/mp4' && q.url && validateSafeHttpUrl(q.url)
      );
      if (mp4?.url) {
        if (!bestUrl) bestUrl = mp4.url;
        native.push({
          id: `mp4-${height}p`,
          label,
          quality: `${height}p`,
          height,
          container: 'mp4',
          kind: 'video',
          sizeBytes: 0,
          url: mp4.url,
        });
      }
    }

    // Dailymotion often provides HLS auto stream; also check 'auto'
    if (!bestUrl) {
      const autoUrl = data.qualities?.['auto']?.[0]?.url;
      if (autoUrl && validateSafeHttpUrl(autoUrl)) {
        bestUrl = autoUrl;
        native.push({
          id: 'mp4-720p',
          label: '720p HD MP4',
          quality: '720p',
          height: 720,
          container: 'mp4',
          kind: 'video',
          sizeBytes: 0,
          url: autoUrl,
          requiresFfmpegScale: true,
        });
      }
    }

    if (!bestUrl) return null;
    const posters = Object.values(data.posters || {});
    return {
      createdAt: Date.now(),
      platform: 'dailymotion',
      sourceUrl: url.toString(),
      title: data.title || 'Dailymotion Video',
      authorHandle: data.owner?.screenname || 'Dailymotion',
      authorName: data.owner?.screenname || 'Dailymotion',
      duration: Number(data.duration || 0),
      coverUrl: normalizeMediaUrl(posters[posters.length - 1], url.toString()),
      previewUrl: bestUrl,
      options: buildStandardResolutionOptions(bestUrl, null, native),
    };
  } catch {
    return null;
  }
}

function sanitizeFilename(input: string): string {
  const cleaned = input
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 48);
  return cleaned || 'snaptok-media';
}

function streamFfmpegOutput(
  res: Response,
  args: string[],
  contentType: string,
  filename: string
) {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const ff = spawn('/usr/bin/ffmpeg', args, {
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  ff.stdout.pipe(res);

  res.on('close', () => {
    if (!ff.killed) {
      ff.kill('SIGKILL');
    }
  });

  ff.on('error', () => {
    if (!res.headersSent) {
      res.status(502).json({ error: 'Media processing failed.' });
    }
  });
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // Built-in Video Search across public YouTube + Dailymotion
  app.get('/api/search', async (req: Request, res: Response) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!query || query.length > 120) {
      res.status(400).json({ error: 'Enter a search query (1-120 characters).' });
      return;
    }

    try {
      const dmPromise = fetch(
        `https://api.dailymotion.com/videos?search=${encodeURIComponent(query)}&limit=8&fields=id,title,thumbnail_480_url,duration,owner.screenname,url`,
        { headers: { 'User-Agent': BROWSER_UA }, signal: AbortSignal.timeout(8000) }
      )
        .then((r) => (r.ok ? r.json() : { list: [] }))
        .catch(() => ({ list: [] }));

      const ytPromise = fetch(
        `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
        { headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9' }, signal: AbortSignal.timeout(9000) }
      )
        .then(async (r) => {
          if (!r.ok) return [];
          const html = await r.text();
          const m = html.match(/var ytInitialData = (\{[\s\S]*?\});<\/script>/);
          if (!m?.[1]) return [];
          const json = JSON.parse(m[1]) as {
            contents?: {
              twoColumnSearchResultsRenderer?: {
                primaryContents?: {
                  sectionListRenderer?: {
                    contents?: Array<{
                      itemSectionRenderer?: {
                        contents?: Array<{
                          videoRenderer?: {
                            videoId?: string;
                            title?: { runs?: Array<{ text?: string }> };
                            ownerText?: { runs?: Array<{ text?: string }> };
                            lengthText?: { simpleText?: string };
                            thumbnail?: { thumbnails?: Array<{ url?: string }> };
                          };
                        }>;
                      };
                    }>;
                  };
                };
              };
            };
          };
          const sections =
            json.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
              ?.contents || [];
          const items: Array<{
            id: string;
            platform: string;
            title: string;
            author: string;
            durationLabel: string;
            thumbnailUrl: string;
            url: string;
          }> = [];
          for (const sec of sections) {
            const list = sec.itemSectionRenderer?.contents || [];
            for (const entry of list) {
              const v = entry.videoRenderer;
              if (!v?.videoId) continue;
              const thumbs = v.thumbnail?.thumbnails || [];
              items.push({
                id: `yt-${v.videoId}`,
                platform: 'YouTube',
                title: v.title?.runs?.map((t) => t.text).join('') || 'YouTube Video',
                author: v.ownerText?.runs?.[0]?.text || 'YouTube',
                durationLabel: v.lengthText?.simpleText || 'Video',
                thumbnailUrl: thumbs[thumbs.length - 1]?.url || '',
                url: `https://www.youtube.com/watch?v=${v.videoId}`,
              });
              if (items.length >= 8) break;
            }
            if (items.length >= 8) break;
          }
          return items;
        })
        .catch(() => []);

      const [dmData, ytItems] = await Promise.all([dmPromise, ytPromise]);
      const dmList = Array.isArray((dmData as { list?: unknown[] }).list)
        ? ((dmData as {
            list: Array<{
              id?: string;
              title?: string;
              thumbnail_480_url?: string;
              duration?: number;
              'owner.screenname'?: string;
              url?: string;
            }>;
          }).list || [])
        : [];

      const dmItems = dmList.map((v) => ({
        id: `dm-${v.id || Math.random()}`,
        platform: 'Dailymotion',
        title: v.title || 'Dailymotion Video',
        author: v['owner.screenname'] || 'Dailymotion',
        durationLabel: v.duration
          ? `${Math.floor(v.duration / 60)}:${(v.duration % 60).toString().padStart(2, '0')}`
          : 'Video',
        thumbnailUrl: v.thumbnail_480_url || '',
        url: v.url || `https://www.dailymotion.com/video/${v.id}`,
      }));

      res.json({ results: [...ytItems, ...dmItems] });
    } catch {
      res.status(502).json({ error: 'Search temporarily unavailable.' });
    }
  });

  app.post('/api/media/resolve', async (req: Request, res: Response) => {
    try {
      cleanupExpiredCache();
      const rawInput = typeof req.body?.url === 'string' ? req.body.url : '';
      const extracted = extractPlatformUrlFromText(rawInput);

      if (!extracted) {
        res.status(400).json({
          error:
            'Please paste a valid TikTok, YouTube, Facebook, Instagram, X, Vimeo, or Dailymotion link (or TikTok Lite share message).',
        });
        return;
      }

      const canonical = await resolveShortRedirects(extracted.url);
      const effectivePlatform = detectPlatformFromUrl(canonical) || extracted.platform;

      let resolved: CachedMediaEntry | null = null;
      switch (effectivePlatform) {
        case 'tiktok':
          resolved = await resolveTikTok(extracted.url, canonical);
          break;
        case 'youtube':
          resolved = await resolveYouTube(canonical);
          break;
        case 'twitter':
          resolved = await resolveTwitter(canonical);
          break;
        case 'vimeo':
          resolved = await resolveVimeo(canonical);
          break;
        case 'dailymotion':
          resolved = await resolveDailymotion(canonical);
          break;
        case 'facebook':
        case 'instagram':
          resolved = await resolveMetaOrGenericOgVideo(canonical, effectivePlatform);
          break;
      }

      if (!resolved) {
        res.status(404).json({
          error:
            'Could not extract media from this link. Make sure the post is public (private or login-only Facebook/Instagram posts cannot be fetched).',
          extractedUrl: canonical.toString(),
        });
        return;
      }

      const token = crypto.randomUUID();
      mediaCache.set(token, resolved);

      res.json({
        token,
        platform: resolved.platform,
        extractedUrl: canonical.toString(),
        title: resolved.title,
        authorHandle: resolved.authorHandle,
        authorName: resolved.authorName,
        duration: resolved.duration,
        thumbnailUrl: resolved.coverUrl ? `/api/media/thumbnail?token=${token}` : null,
        previewUrl: resolved.previewUrl ? `/api/media/stream?token=${token}` : null,
        options: resolved.options.map((opt) => ({
          id: opt.id,
          label: opt.label,
          quality: opt.quality,
          height: opt.height,
          container: opt.container,
          kind: opt.kind,
          sizeBytes: opt.sizeBytes,
          transcoded: Boolean(opt.requiresFfmpegScale || opt.requiresFfmpegAudio),
        })),
      });
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : 'Unable to resolve media link.',
      });
    }
  });

  app.get('/api/media/thumbnail', async (req: Request, res: Response) => {
    cleanupExpiredCache();
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const entry = mediaCache.get(token);

    if (!entry || !entry.coverUrl) {
      res.status(404).end();
      return;
    }

    try {
      const upstream = await fetch(entry.coverUrl, {
        headers: { 'User-Agent': BROWSER_UA, Referer: entry.sourceUrl },
        signal: AbortSignal.timeout(10000),
      });
      if (!upstream.ok || !upstream.body) {
        res.status(502).end();
        return;
      }
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'private, max-age=1800');
      Readable.fromWeb(upstream.body as unknown as NodeWebReadableStream).pipe(res);
    } catch {
      res.status(502).end();
    }
  });

  // In-browser video preview stream (supports built-in player & Picture-in-Picture)
  app.get('/api/media/stream', async (req: Request, res: Response) => {
    cleanupExpiredCache();
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const entry = mediaCache.get(token);
    if (!entry || !entry.previewUrl) {
      res.status(404).end();
      return;
    }

    const safeTarget = validateSafeHttpUrl(entry.previewUrl);
    if (!safeTarget) {
      res.status(400).end();
      return;
    }

    try {
      const headers: Record<string, string> = {
        'User-Agent': BROWSER_UA,
        Referer: entry.sourceUrl,
      };
      if (entry.cookies) headers.Cookie = entry.cookies;
      if (typeof req.headers.range === 'string') {
        headers.Range = req.headers.range;
      }

      const upstream = await fetch(safeTarget.toString(), {
        headers,
        signal: AbortSignal.timeout(25000),
      });

      if (!upstream.ok || !upstream.body) {
        res.status(502).end();
        return;
      }

      res.status(upstream.status);
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'video/mp4');
      const acceptRanges = upstream.headers.get('accept-ranges');
      if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);
      const contentRange = upstream.headers.get('content-range');
      if (contentRange) res.setHeader('Content-Range', contentRange);
      const contentLength = upstream.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);

      Readable.fromWeb(upstream.body as unknown as NodeWebReadableStream).pipe(res);
    } catch {
      res.status(502).end();
    }
  });

  app.get('/api/media/download', async (req: Request, res: Response) => {
    cleanupExpiredCache();
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const optionId = typeof req.query.optionId === 'string' ? req.query.optionId : '';
    const entry = mediaCache.get(token);

    if (!entry) {
      res.status(404).json({ error: 'Download session expired. Please fetch the link again.' });
      return;
    }

    const option = entry.options.find((o) => o.id === optionId) || entry.options[0];
    if (!option) {
      res.status(404).json({ error: 'Requested quality format is not available.' });
      return;
    }

    const safeTarget = validateSafeHttpUrl(option.url);
    if (!safeTarget) {
      res.status(400).json({ error: 'Invalid media target.' });
      return;
    }

    const baseName = sanitizeFilename(entry.title);
    const filename = `${baseName}-${option.quality}.${option.container}`;

    // Audio transcoding via ffmpeg (MP3 or M4A)
    if (option.requiresFfmpegAudio) {
      const audioArgs =
        option.container === 'mp3'
          ? [
              '-y',
              '-i',
              safeTarget.toString(),
              '-vn',
              '-c:a',
              'libmp3lame',
              '-b:a',
              '192k',
              '-f',
              'mp3',
              'pipe:1',
            ]
          : [
              '-y',
              '-i',
              safeTarget.toString(),
              '-vn',
              '-c:a',
              'aac',
              '-b:a',
              '192k',
              '-movflags',
              'frag_keyframe+empty_moov',
              '-f',
              'mp4',
              'pipe:1',
            ];
      streamFfmpegOutput(
        res,
        audioArgs,
        option.container === 'mp3' ? 'audio/mpeg' : 'audio/mp4',
        filename
      );
      return;
    }

    // Mux adaptive video + audio (e.g. YouTube 1080p/4K)
    if (option.audioMuxUrl) {
      const safeAudio = validateSafeHttpUrl(option.audioMuxUrl);
      if (!safeAudio) {
        res.status(400).json({ error: 'Invalid audio stream target.' });
        return;
      }
      streamFfmpegOutput(
        res,
        [
          '-y',
          '-i',
          safeTarget.toString(),
          '-i',
          safeAudio.toString(),
          '-c:v',
          'copy',
          '-c:a',
          'aac',
          '-movflags',
          'frag_keyframe+empty_moov',
          '-f',
          'mp4',
          'pipe:1',
        ],
        'video/mp4',
        filename
      );
      return;
    }

    // Scale MP4 to requested resolution (144p, 360p, 720p, 1080p) via ffmpeg when needed
    if (option.requiresFfmpegScale) {
      const targetHeight = Math.max(144, Math.min(2160, Math.round(option.height)));
      const tmpOut = path.join(os.tmpdir(), `snaptok-${crypto.randomUUID()}.mp4`);
      const args = [
        '-y',
        '-i',
        safeTarget.toString(),
        '-vf',
        `scale=-2:'min(ih,${targetHeight})'`,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        tmpOut,
      ];

      const ff = spawn('/usr/bin/ffmpeg', args, { shell: false, stdio: 'ignore' });
      ff.on('exit', (code) => {
        if (code !== 0 || !fs.existsSync(tmpOut)) {
          fs.rm(tmpOut, { force: true }, () => {});
          if (!res.headersSent) {
            res.status(502).json({ error: 'Failed to transcode video resolution.' });
          }
          return;
        }
        res.download(tmpOut, filename, () => {
          fs.rm(tmpOut, { force: true }, () => {});
        });
      });
      res.on('close', () => {
        if (!ff.killed) ff.kill('SIGKILL');
        fs.rm(tmpOut, { force: true }, () => {});
      });
      return;
    }

    // Direct native stream proxy
    try {
      const headers: Record<string, string> = {
        'User-Agent': BROWSER_UA,
        Referer: entry.sourceUrl,
      };
      if (entry.cookies) headers.Cookie = entry.cookies;

      const upstream = await fetch(safeTarget.toString(), {
        headers,
        signal: AbortSignal.timeout(30000),
      });
      if (!upstream.ok || !upstream.body) {
        res.status(502).json({ error: 'Failed to stream media from source CDN.' });
        return;
      }

      const fallbackMime =
        option.container === 'mp3'
          ? 'audio/mpeg'
          : option.container === 'm4a'
            ? 'audio/mp4'
            : 'video/mp4';
      res.setHeader('Content-Type', upstream.headers.get('content-type') || fallbackMime);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      const contentLength = upstream.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);

      Readable.fromWeb(upstream.body as unknown as NodeWebReadableStream).pipe(res);
    } catch {
      res.status(502).json({ error: 'Download interrupted while streaming media.' });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SnapTok HD server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
