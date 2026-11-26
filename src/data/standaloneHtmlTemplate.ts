export const STANDALONE_HTML_CODE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SnapTok HD — Multi-Platform Video &amp; MP3 Downloader</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = { darkMode: 'class' };
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    body { font-family: "Plus Jakarta Sans", system-ui, sans-serif; }
  </style>
</head>
<body class="bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 antialiased transition-colors">
  <!-- Header -->
  <header class="border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur sticky top-0 z-30">
    <div class="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-8">
      <a href="#top" class="flex items-center gap-2.5 text-lg font-extrabold tracking-tight whitespace-nowrap shrink-0">
        <span class="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center text-white font-extrabold text-sm">↓</span>
        SnapTok
      </a>
      <nav class="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-600 dark:text-zinc-400">
        <a href="#downloader" class="hover:text-zinc-900 dark:hover:text-white whitespace-nowrap">Downloader</a>
        <a href="#batch" class="hover:text-zinc-900 dark:hover:text-white whitespace-nowrap">Batch Queue</a>
        <a href="#steps" class="hover:text-zinc-900 dark:hover:text-white whitespace-nowrap">How to Save</a>
      </nav>
      <button id="theme-toggle" type="button" class="px-4 py-2 text-xs font-semibold rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer whitespace-nowrap">
        Dark Mode
      </button>
    </div>
  </header>

  <main id="top" class="max-w-4xl mx-auto px-6 py-12 space-y-14">
    <!-- Hero & Multi-Platform Downloader -->
    <section id="downloader" class="text-center">
      <h1 class="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
        Download Videos in 4K, 1080p HD &amp; MP3
      </h1>
      <p class="mt-4 text-base text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
        Supports TikTok (including TikTok Lite share messages), YouTube, Facebook, Instagram, X (Twitter), Vimeo &amp; Dailymotion.
      </p>

      <form id="media-form" class="mt-8 flex flex-col sm:flex-row gap-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-2">
        <input
          id="media-input"
          type="text"
          required
          placeholder="Paste video link or TikTok Lite share text..."
          class="flex-1 bg-transparent px-4 py-3 text-sm focus:outline-none"
        />
        <button type="button" id="paste-btn" class="px-4 py-2.5 text-xs font-semibold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl cursor-pointer">
          Paste
        </button>
        <button type="submit" id="fetch-btn" class="px-7 py-3 text-sm font-bold text-white bg-[#FF5500] hover:bg-[#E04800] rounded-full cursor-pointer">
          Fetch Formats
        </button>
      </form>

      <div id="clean-url-note" class="hidden mt-2 text-xs text-zinc-500 text-left"></div>
      <div id="error-box" class="hidden mt-4 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300 text-left"></div>

      <!-- Result Card -->
      <div id="result-box" class="hidden mt-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 text-left">
        <div class="flex flex-col sm:flex-row gap-5">
          <img id="video-cover" src="" alt="Video cover" referrerpolicy="no-referrer" class="w-full sm:w-40 h-52 object-cover rounded-xl bg-zinc-100 dark:bg-zinc-800 shrink-0" />
          <div class="flex-1 min-w-0">
            <div class="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-2">
              <span id="video-platform">TikTok</span>
              <span>·</span>
              <span id="video-author">@creator</span>
              <span>·</span>
              <span id="video-duration">0:00</span>
            </div>
            <h2 id="video-title" class="mt-2 text-lg font-bold line-clamp-2"></h2>
            <div id="format-buttons" class="mt-5 flex flex-wrap gap-2.5"></div>
            <div class="mt-4 flex flex-wrap gap-3">
              <button type="button" id="watch-btn" class="px-4 py-2 rounded-full border border-zinc-300 dark:border-zinc-700 text-xs font-semibold cursor-pointer">
                Play in Built-in Player
              </button>
              <button type="button" id="pip-btn" class="px-4 py-2 rounded-full border border-zinc-300 dark:border-zinc-700 text-xs font-semibold cursor-pointer">
                Floating PiP Window
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Built-in HTML5 Player -->
    <section id="player-box" class="hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 p-4 text-white">
      <div class="flex items-center justify-between mb-3">
        <span id="player-title" class="text-sm font-semibold truncate">Built-in Player</span>
        <button type="button" id="close-player" class="text-xs text-zinc-400 hover:text-white cursor-pointer">Close</button>
      </div>
      <video id="html5-player" controls playsinline class="w-full max-h-96 rounded-xl bg-black"></video>
    </section>

    <!-- Batch Download Section -->
    <section id="batch" class="border-t border-zinc-200 dark:border-zinc-800 pt-10">
      <h2 class="text-xl font-bold">Batch Download Queue</h2>
      <p class="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Paste multiple links (one per line) to resolve and save sequentially.</p>
      <textarea id="batch-input" rows="3" placeholder="https://vm.tiktok.com/...&#10;https://www.youtube.com/watch?v=..." class="mt-4 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-3 text-sm focus:outline-none"></textarea>
      <div class="mt-3 flex items-center gap-3">
        <button type="button" id="run-batch" class="px-5 py-2.5 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold cursor-pointer">
          Process Batch Queue
        </button>
        <span id="batch-status" class="text-xs text-zinc-500"></span>
      </div>
    </section>

    <!-- Step-by-Step Guide -->
    <section id="steps" class="border-t border-zinc-200 dark:border-zinc-800 pt-10 grid sm:grid-cols-2 gap-8">
      <div>
        <h2 class="text-lg font-bold">Step 1. Paste Any Share Message or Link</h2>
        <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Even if TikTok Lite adds extra text like "Download TikTok Lite...", SnapTok automatically extracts the clean video link.</p>
      </div>
      <div>
        <h2 class="text-lg font-bold">Step 2. Choose 144p–4K or MP3/M4A</h2>
        <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Pick your preferred video resolution or convert any video directly into MP3 or M4A audio.</p>
      </div>
    </section>
  </main>

  <script>
    // Theme Toggle
    const themeBtn = document.getElementById('theme-toggle');
    themeBtn.addEventListener('click', () => {
      document.documentElement.classList.toggle('dark');
      themeBtn.textContent = document.documentElement.classList.contains('dark') ? 'Light Mode' : 'Dark Mode';
    });

    // Messy Share-Text Extractor (Handles TikTok Lite share messages)
    function extractCleanUrl(rawText) {
      const urls = rawText.match(/https?:\\/\\/[^\\s"'<>]+/gi) || [];
      const filtered = urls
        .map((u) => u.replace(/[.,!?;:)\\]]+$/, ''))
        .filter((u) => !u.toLowerCase().includes('tiktok.com/tiktoklite') && !u.toLowerCase().includes('play.google.com'));
      return filtered[0] || rawText.trim();
    }

    const mediaInput = document.getElementById('media-input');
    const cleanNote = document.getElementById('clean-url-note');
    const errorBox = document.getElementById('error-box');
    const resultBox = document.getElementById('result-box');
    const playerBox = document.getElementById('player-box');
    const videoEl = document.getElementById('html5-player');
    let currentPreviewUrl = '';

    document.getElementById('paste-btn').addEventListener('click', async () => {
      try {
        const txt = await navigator.clipboard.readText();
        if (txt) mediaInput.value = txt.trim();
      } catch { mediaInput.focus(); }
    });

    async function resolveLink(rawText) {
      const cleaned = extractCleanUrl(rawText);
      if (cleaned !== rawText.trim()) {
        cleanNote.textContent = 'Extracted link: ' + cleaned;
        cleanNote.classList.remove('hidden');
      } else {
        cleanNote.classList.add('hidden');
      }

      if (window.location.protocol.startsWith('http') && window.location.hostname) {
        try {
          const res = await fetch('/api/media/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: rawText })
          });
          if (res.ok) return await res.json();
        } catch {}
      }

      // Standalone fallback for TikTok links when opened locally without Node server
      const tikRes = await fetch('https://www.tikwm.com/api/?url=' + encodeURIComponent(cleaned) + '&hd=1');
      const tikJson = await tikRes.json();
      if (tikJson.code !== 0 || !tikJson.data) throw new Error('Unable to resolve video link.');
      const d = tikJson.data;
      const abs = (u) => (u && u.startsWith('/') ? 'https://www.tikwm.com' + u : u);
      return {
        platform: 'tiktok',
        title: d.title || 'TikTok Video',
        authorHandle: d.author && d.author.unique_id ? '@' + d.author.unique_id : '@creator',
        duration: d.duration || 0,
        thumbnailUrl: abs(d.cover || ''),
        previewUrl: abs(d.hdplay || d.play || ''),
        options: [
          { id: 'hd', label: '1080p Full HD MP4', directUrl: abs(d.hdplay || d.play) },
          { id: 'sd', label: '720p HD MP4', directUrl: abs(d.play) },
          { id: 'mp3', label: 'MP3 Audio', directUrl: abs(d.music) }
        ]
      };
    }

    document.getElementById('media-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.classList.add('hidden');
      resultBox.classList.add('hidden');
      const fetchBtn = document.getElementById('fetch-btn');
      fetchBtn.disabled = true;
      fetchBtn.textContent = 'Fetching...';

      try {
        const data = await resolveLink(mediaInput.value);
        document.getElementById('video-cover').src = data.thumbnailUrl || '';
        document.getElementById('video-platform').textContent = (data.platform || 'Video').toUpperCase();
        document.getElementById('video-author').textContent = data.authorHandle || '';
        document.getElementById('video-duration').textContent = (data.duration || 0) + 's';
        document.getElementById('video-title').textContent = data.title || 'Media';
        currentPreviewUrl = data.previewUrl || '';

        const btnWrap = document.getElementById('format-buttons');
        btnWrap.innerHTML = '';
        (data.options || []).forEach((opt, idx) => {
          const a = document.createElement('a');
          a.href = opt.directUrl || ('/api/media/download?token=' + encodeURIComponent(data.token) + '&optionId=' + encodeURIComponent(opt.id));
          a.setAttribute('download', '');
          a.className = idx === 0
            ? 'px-4 py-2 rounded-full bg-[#FF5500] text-white text-xs font-bold'
            : 'px-4 py-2 rounded-full border border-zinc-300 dark:border-zinc-700 text-xs font-semibold';
          a.textContent = opt.label;
          btnWrap.appendChild(a);
        });
        resultBox.classList.remove('hidden');
      } catch (err) {
        errorBox.textContent = err.message || 'Could not resolve link.';
        errorBox.classList.remove('hidden');
      } finally {
        fetchBtn.disabled = false;
        fetchBtn.textContent = 'Fetch Formats';
      }
    });

    document.getElementById('watch-btn').addEventListener('click', () => {
      if (!currentPreviewUrl) return;
      videoEl.src = currentPreviewUrl;
      playerBox.classList.remove('hidden');
      videoEl.play().catch(() => {});
    });

    document.getElementById('pip-btn').addEventListener('click', async () => {
      if (!currentPreviewUrl) return;
      if (videoEl.src !== currentPreviewUrl) {
        videoEl.src = currentPreviewUrl;
        playerBox.classList.remove('hidden');
      }
      await videoEl.play().catch(() => {});
      if (document.pictureInPictureEnabled && videoEl.requestPictureInPicture) {
        await videoEl.requestPictureInPicture().catch(() => {});
      }
    });

    document.getElementById('close-player').addEventListener('click', () => {
      videoEl.pause();
      playerBox.classList.add('hidden');
    });

    document.getElementById('run-batch').addEventListener('click', async () => {
      const lines = document.getElementById('batch-input').value.split(/\\n+/).map((s) => s.trim()).filter(Boolean);
      const status = document.getElementById('batch-status');
      for (let i = 0; i < lines.length; i++) {
        status.textContent = 'Processing ' + (i + 1) + ' of ' + lines.length + '...';
        try {
          const data = await resolveLink(lines[i]);
          const first = data.options && data.options[0];
          if (first) {
            const a = document.createElement('a');
            a.href = first.directUrl || ('/api/media/download?token=' + encodeURIComponent(data.token) + '&optionId=' + encodeURIComponent(first.id));
            a.setAttribute('download', '');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
        } catch {}
      }
      status.textContent = lines.length ? 'Completed ' + lines.length + ' items.' : 'Add links first.';
    });
  </script>
</body>
</html>`;
