let isClipping = false;
let mediaRecorder = null;
let recordedChunks = [];
let shortcuts = {};

function loadShortcuts() {
    return fetch('/shortcuts/json')
        .then(res => res.json())
        .then(data => {
            shortcuts = data;
        })
        .catch(() => {});
}

function getShortcutKey(shortcutName) {
    return shortcuts[shortcutName] || '';
}

function parseShortcut(shortcutStr) {
    if (!shortcutStr) return null;
    
    const parts = shortcutStr.toLowerCase().split('+');
    const result = {
        ctrl: parts.includes('ctrl'),
        alt: parts.includes('alt'),
        shift: parts.includes('shift'),
        key: parts.filter(p => !['ctrl', 'alt', 'shift'].includes(p))[0] || ''
    };
    return result.key ? result : null;
}

function matchesShortcut(e, shortcutStr) {
    const parsed = parseShortcut(shortcutStr);
    if (!parsed) return false;
    
    const eKey = e.key.toLowerCase();
    const expectedKey = parsed.key;
    
    if (eKey !== expectedKey && 
        !(eKey === ' ' && expectedKey === 'space') &&
        !(expectedKey === 'arrowleft' && eKey === 'arrowleft') &&
        !(expectedKey === 'arrowright' && eKey === 'arrowright') &&
        !(expectedKey === 'arrowup' && eKey === 'arrowup') &&
        !(expectedKey === 'arrowdown' && eKey === 'arrowdown')) {
        return false;
    }
    
    return e.ctrlKey === parsed.ctrl && 
           e.altKey === parsed.alt && 
           e.shiftKey === parsed.shift;
}

const osd = document.createElement('div');
osd.style.position = 'absolute';
osd.style.top = '10px';
osd.style.left = '10px';
osd.style.backgroundColor = 'rgb(186, 187, 241)';
osd.style.color = 'white';
osd.style.padding = '5px';
osd.style.borderRadius= '20px';
osd.style.zIndex = '1000';
osd.style.display = 'none';
osd.id = 'video-osd';

const plyrContainer = document.querySelector('.plyr');
if (plyrContainer) {
    plyrContainer.style.position = 'relative';
    plyrContainer.appendChild(osd);
} else {
    console.warn("Plyr container not found");
}

function updateOSD(text) {
    osd.textContent = text;
    osd.style.display = 'block';
    clearTimeout(osd.timeout);
    osd.timeout = setTimeout(() => {
        osd.style.display = 'none';
    }, 2000);
}

function findQualitySelection(resolution) {
    if (typeof data === 'undefined' || (!data.uni_sources && !data.pair_sources)) {
        return null;
    }

    const targetQualityString = `${resolution}p`;

    if (data.uni_sources) {
        for (let i = 0; i < data.uni_sources.length; i++) {
            if (data.uni_sources[i].quality_string === targetQualityString) {
                return { type: 'uni', index: i, quality: targetQualityString };
            }
        }
    }

    if (data.pair_sources) {
        for (let i = 0; i < data.pair_sources.length; i++) {
            if (data.pair_sources[i].quality_string === targetQualityString) {
                return { type: 'pair', index: i, quality: targetQualityString };
            }
        }
    }
    return null;
}

function onKeyDown(e) {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return false;

    const v = document.querySelector('video');
    if (!v || !e.isTrusted) return;

    const c = e.key.toLowerCase();

    if (e.ctrlKey && c >= '1' && c <= '8') {
        e.preventDefault();
        let resolution;
        switch (c) {
            case '1': resolution = 2160; break;
            case '2': resolution = 1440; break;
            case '3': resolution = 1080; break;
            case '4': resolution = 720; break;
            case '5': resolution = 480; break;
            case '6': resolution = 360; break;
            case '7': resolution = 240; break;
            case '8': resolution = 144; break;
            default: return;
        }

        const selection = findQualitySelection(resolution);
        if (selection) {
            if (typeof changeQuality === 'function') {
                changeQuality({ type: selection.type, index: selection.index });
                updateOSD(`Quality: ${selection.quality}`);
            } else {
                updateOSD("Error: Quality change failed.");
            }
        } else {
            updateOSD(`Quality ${resolution}p not available.`);
        }
        return;
    }

    if (matchesShortcut(e, getShortcutKey('record_clip'))) {
        e.preventDefault();
        if (!isClipping) {
            startRecordingClip(v);
            updateOSD("Recording started");
        } else {
            stopRecordingClip();
            updateOSD("Recording stopped");
        }
        return;
    }

    if (matchesShortcut(e, getShortcutKey('screenshot'))) {
        e.preventDefault();
        takeVideoScreenshot(v);
        updateOSD("Screenshot taken");
        return;
    }

    if (matchesShortcut(e, getShortcutKey('jump_to_time'))) {
        e.preventDefault();
        const timeInput = prompt('Jump to time (e.g., 1:30 or 90):');
        if (timeInput) {
            jumpToTime(timeInput, v);
            updateOSD(`Jumped to ${timeInput}`);
        }
        return;
    }

    if (matchesShortcut(e, getShortcutKey('play_pause'))) {
        e.preventDefault();
        v.paused ? v.play() : v.pause();
        updateOSD(v.paused ? "Paused" : "Playing");
        return;
    }

    if (matchesShortcut(e, getShortcutKey('seek_back_5'))) {
        e.preventDefault();
        v.currentTime -= 5;
        updateOSD("-5 seconds");
        return;
    }

    if (matchesShortcut(e, getShortcutKey('seek_forward_5'))) {
        e.preventDefault();
        v.currentTime += 5;
        updateOSD("+5 seconds");
        return;
    }

    if (matchesShortcut(e, getShortcutKey('seek_back_10'))) {
        e.preventDefault();
        v.currentTime -= 10;
        updateOSD("-10 seconds");
        return;
    }

    if (matchesShortcut(e, getShortcutKey('seek_forward_10'))) {
        e.preventDefault();
        v.currentTime += 10;
        updateOSD("+10 seconds");
        return;
    }

    if (matchesShortcut(e, getShortcutKey('seek_back_30'))) {
        e.preventDefault();
        v.currentTime -= 30;
        updateOSD("-30 seconds");
        return;
    }

    if (matchesShortcut(e, getShortcutKey('seek_forward_30'))) {
        e.preventDefault();
        v.currentTime += 30;
        updateOSD("+30 seconds");
        return;
    }

    if (matchesShortcut(e, getShortcutKey('volume_up'))) {
        e.preventDefault();
        v.volume = Math.min(1, v.volume + 0.05);
        updateOSD(`Volume: ${Math.round(v.volume * 100)}%`);
        return;
    }

    if (matchesShortcut(e, getShortcutKey('volume_down'))) {
        e.preventDefault();
        v.volume = Math.max(0, v.volume - 0.05);
        updateOSD(`Volume: ${Math.round(v.volume * 100)}%`);
        return;
    }

    if (matchesShortcut(e, getShortcutKey('speed_up'))) {
        e.preventDefault();
        v.playbackRate = Math.min(4, v.playbackRate + 0.1);
        updateOSD(`Speed: ${v.playbackRate.toFixed(1)}x`);
        return;
    }

    if (matchesShortcut(e, getShortcutKey('speed_down'))) {
        e.preventDefault();
        v.playbackRate = Math.max(0.1, v.playbackRate - 0.1);
        updateOSD(`Speed: ${v.playbackRate.toFixed(1)}x`);
        return;
    }

    if (matchesShortcut(e, getShortcutKey('loop'))) {
        e.preventDefault();
        v.loop = !v.loop;
        updateOSD(`Loop ${v.loop ? 'enabled' : 'disabled'}`);
        return;
    }

    if (matchesShortcut(e, getShortcutKey('fullscreen'))) {
        e.preventDefault();
        if (typeof data !== 'undefined' && data.settings?.video_player === 1) {
            player.fullscreen.toggle();
        } else {
            if (document.fullscreenElement) document.exitFullscreen();
            else v.requestFullscreen();
        }
        updateOSD("Fullscreen toggled");
        return;
    }

    if (matchesShortcut(e, getShortcutKey('mute'))) {
        e.preventDefault();
        v.muted = !v.muted;
        updateOSD(v.muted ? 'Muted' : 'Unmuted');
        return;
    }

    if (matchesShortcut(e, getShortcutKey('save_note'))) {
        e.preventDefault();
        const note = prompt("Enter note for this timestamp:");
        if (note) {
            const timestamp = Math.floor(v.currentTime);
            localStorage.setItem(`note_${timestamp}`, note);
            updateOSD(`Note saved at ${timestamp}s`);
        }
        return;
    }

    if (matchesShortcut(e, getShortcutKey('copy_timestamp'))) {
        const ts = Math.floor(v.currentTime);
        copyTextToClipboard(`https://youtu.be/${data.video_id}?t=${ts}`);
        updateOSD("Timestamp copied");
        return;
    }
}

function takeVideoScreenshot(video) {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        const timestamp = Math.floor(video.currentTime);
        a.download = `screenshot_${timestamp}s.png`;
        a.click();
    }, 'image/png');
}

function jumpToTime(timeString, video) {
    let seconds = 0;

    if (/^\d+:\d+$/.test(timeString)) {
        const [min, sec] = timeString.split(':').map(Number);
        seconds = min * 60 + sec;
    } else if (/^\d+s?$/.test(timeString)) {
        seconds = parseInt(timeString.replace('s', ''));
    } else if (!isNaN(parseFloat(timeString))) {
        seconds = parseFloat(timeString);
    }

    if (!isNaN(seconds) && seconds >= 0 && seconds <= video.duration) {
        video.currentTime = seconds;
    } else {
        alert("Invalid time or out of bounds.");
    }
}

function startRecordingClip(video) {
    if (!MediaRecorder) {
        alert("MediaRecorder API not supported in this browser.");
        return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');

    const stream = canvas.captureStream();
    recordedChunks = [];

    const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

    let options = { mimeType: 'video/webm; codecs=vp9' };
    if (isFirefox) {
        options = { mimeType: 'video/webm; codecs=vp8' };
    }

    try {
        mediaRecorder = new MediaRecorder(stream, options);
    } catch (err) {
        alert("Error starting MediaRecorder: " + err.message);
        return;
    }

    mediaRecorder.ondataavailable = function (e) {
        if (e.data.size > 0) {
            recordedChunks.push(e.data);
        }
    };

    mediaRecorder.onstop = function () {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        const timestamp = Date.now();
        a.download = `clip_${timestamp}.webm`;
        a.click();

        URL.revokeObjectURL(url);
    };

    isClipping = true;

    function drawFrame() {
        if (!isClipping) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(drawFrame);
    }

    drawFrame();
    mediaRecorder.start();
}

function stopRecordingClip() {
    isClipping = false;
    mediaRecorder.stop();
}

function copyTextToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => console.log('Copied:', text))
        .catch(err => console.error('Copy failed:', err));
}

function Q(sel) {
    return document.querySelector(sel);
}

window.addEventListener('DOMContentLoaded', () => {
    loadShortcuts().then(() => {
        document.addEventListener('keydown', onKeyDown);
    });
});
