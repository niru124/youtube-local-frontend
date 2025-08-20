let isClipping = false;
let mediaRecorder = null;
let recordedChunks = [];

// --- Add the OSD element ---
const osd = document.createElement('div');
osd.style.position = 'absolute';
osd.style.top = '10px';
osd.style.left = '10px';
osd.style.backgroundColor = 'rgb(186, 187, 241)';
osd.style.color = 'white';
osd.style.padding = '5px';
osd.style.zIndex = '1000'; // Ensure it's on top
osd.style.display = 'none'; // Initially hidden
osd.id = 'video-osd';

document.body.appendChild(osd);


function updateOSD(text) {
    osd.textContent = text;
    osd.style.display = 'block';
    clearTimeout(osd.timeout); // Clear any previous timeout
    osd.timeout = setTimeout(() => {
        osd.style.display = 'none';
    }, 2000); // Hide after 2 seconds
}

function onKeyDown(e) {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return false;

    const v = Q("video");
    if (!v || !e.isTrusted) return;

    const c = e.key.toLowerCase();

    // Press 'c' to start/stop recording a clip
    if (c === 'c') {
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
    // --- Screenshot: S --else if (c === 'i') {
    else if (c === 's') {
        e.preventDefault();
        takeVideoScreenshot(v);
        updateOSD("Screenshot taken");
        return;
    }

    // --- Ctrl+G: Jump to time ---
    if (e.ctrlKey && c === 'g') {
        e.preventDefault();
        const timeInput = prompt('Jump to time (e.g., 1:30 or 90):');
        if (timeInput) {
            jumpToTime(timeInput, v);
            updateOSD(`Jumped to ${timeInput}`);
        }
        return;
    }

    if (e.ctrlKey) return;

    // --- Playback & navigation ---
    if (c === "k" || c === " ") {
        e.preventDefault();
        v.paused ? v.play() : v.pause();
        updateOSD(v.paused ? "Paused" : "Playing");
    } else if (c === "arrowleft") {
        e.preventDefault();
        v.currentTime -= 5;
        updateOSD("-5 seconds");
    } else if (c === "arrowright") {
        e.preventDefault();
        v.currentTime += 5;
        updateOSD("+5 seconds");
    } else if (c === "j") {
        e.preventDefault();
        v.currentTime -= 10;
        updateOSD("-10 seconds");
    } else if (c === "l") {
        e.preventDefault();
        v.currentTime += 10;
        updateOSD("+10 seconds");
    } else if (c === "arrowdown") {
        e.preventDefault();
        v.currentTime -= 30;
        updateOSD("-30 seconds");
    } else if (c === "arrowup") {
        e.preventDefault();
        v.currentTime += 30;
        updateOSD("+30 seconds");
    } else if (c === "0") {
        e.preventDefault();
        v.volume = Math.min(1, v.volume + 0.05);
        updateOSD(`Volume: ${Math.round(v.volume * 100)}%`);
    } else if (c === "9") {
        e.preventDefault();
        v.volume = Math.max(0, v.volume - 0.05);
        updateOSD(`Volume: ${Math.round(v.volume * 100)}%`);
    } else if (c === ".") {
        e.preventDefault();
        v.playbackRate = Math.min(4, v.playbackRate + 0.1);
        updateOSD(`Speed: ${v.playbackRate.toFixed(1)}x`);
    } else if (c === ",") {
        e.preventDefault();
        v.playbackRate = Math.max(0.1, v.playbackRate - 0.1);
        updateOSD(`Speed: ${v.playbackRate.toFixed(1)}x`);
    } else if (c === "f") {
        e.preventDefault();
        if (typeof data !== 'undefined' && data.settings?.video_player === 1) {
            player.fullscreen.toggle();
        } else {
            if (document.fullscreenElement) document.exitFullscreen();
            else v.requestFullscreen();
        }
        updateOSD("Fullscreen toggled");
    }

    // --- X: Save note ---
    else if (c === 'x') {
        e.preventDefault();
        const note = prompt("Enter note for this timestamp:");
        if (note) {
            const timestamp = Math.floor(v.currentTime);
            localStorage.setItem(`note_${timestamp}`, note);
            updateOSD(`Note saved at ${timestamp}s`);
        }
    }

    // --- T: Copy YouTube timestamp link ---
    else if (c === "t") {
        const ts = Math.floor(v.currentTime);
        copyTextToClipboard(`https://youtu.be/${data.video_id}?t=${ts}`);
        updateOSD("Timestamp copied");
    }
}

// --- Screenshot function ---
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

// --- Jump to time helper ---
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

// --- Clipboard copy ---
function copyTextToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => console.log('Copied:', text))
        .catch(err => console.error('Copy failed:', err));
}

// Query shortcut
function Q(sel) {
    return document.querySelector(sel);
}

// Shortcuts init
window.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('keydown', onKeyDown);
});
