"use strict";

var sha256 = function a(b) { function c(a, b) { return a >>> b | a << 32 - b } for (var d, e, f = Math.pow, g = f(2, 32), h = "length", i = "", j = [], k = 8 * b[h], l = a.h = a.h || [], m = a.k = a.k || [], n = m[h], o = {}, p = 2; 64 > n; p++)if (!o[p]) { for (d = 0; 313 > d; d += p)o[d] = p; l[n] = f(p, .5) * g | 0, m[n++] = f(p, 1 / 3) * g | 0 } for (b += "\x80"; b[h] % 64 - 56;)b += "\x00"; for (d = 0; d < b[h]; d++) { if (e = b.charCodeAt(d), e >> 8) return; j[d >> 2] |= e << (3 - d) % 4 * 8 } for (j[j[h]] = k / g | 0, j[j[h]] = k, e = 0; e < j[h];) { var q = j.slice(e, e += 16), r = l; for (l = l.slice(0, 8), d = 0; 64 > d; d++) { var s = q[d - 15], t = q[d - 2], u = l[0], v = l[4], w = l[7] + (c(v, 6) ^ c(v, 11) ^ c(v, 25)) + (v & l[5] ^ ~v & l[6]) + m[d] + (q[d] = 16 > d ? q[d] : q[d - 16] + (c(s, 7) ^ c(s, 18) ^ s >>> 3) + q[d - 7] + (c(t, 17) ^ c(t, 19) ^ t >>> 10) | 0), x = (c(u, 2) ^ c(u, 13) ^ c(u, 22)) + (u & l[1] ^ u & l[2] ^ l[1] & l[2]); l = [w + x | 0].concat(l), l[4] = l[4] + w | 0 } for (d = 0; 8 > d; d++)l[d] = l[d] + r[d] | 0 } for (d = 0; 8 > d; d++)for (e = 3; e + 1; e--) { var y = l[d] >> 8 * e & 255; i += (16 > y ? 0 : "") + y.toString(16) } return i };

function generateUserID() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getSponsorBlockUserID() {
  let userID = localStorage.getItem('sponsorblock_userID');
  if (!userID) {
    userID = generateUserID();
    localStorage.setItem('sponsorblock_userID', userID);
  }
  return userID;
}

const CATEGORY_INFO = {
  sponsor: { label: 'Sponsor', description: 'Paid promotion or referral' },
  intro: { label: 'Intro', description: 'Intro/outro animation' },
  outro: { label: 'Outro', description: 'End cards/credits' },
  preview: { label: 'Preview', description: 'Preview of next video' },
  selfpromo: { label: 'Self-promo', description: 'Self-promotion or merchandise' },
  exclusive_access: { label: 'Exclusive Access', description: 'Content only on this platform' },
  interaction: { label: 'Interaction', description: 'Subscribe reminder' },
  music_offtopic: { label: 'Music Offtopic', description: 'Non-music segment in music video' },
  filler: { label: 'Filler', description: 'Tangential/funny content' },
};

window.load_sponsorblock = async function() {
  const video_obj = Q("video");
  if (!video_obj) return;

  if (!window.data || !data.video_id) {
    console.error("SponsorBlock: data.video_id is not defined.");
    return;
  }

  console.log("SponsorBlock: Video ID:", data.video_id);

  const skipSettings = {
    sponsor: data.sb_sponsor !== false,
    intro: data.sb_intro !== false,
    outro: data.sb_outro !== false,
    preview: data.sb_preview !== false,
    selfpromo: data.sb_selfpromo !== false,
    exclusive_access: data.sb_exclusive_access !== false,
    interaction: data.sb_interaction !== false,
    music_offtopic: data.sb_music_offtopic !== false,
    filler: data.sb_filler !== false,
  };

  const colorSettings = {
    sponsor: data.sb_sponsor_color || '#a6d189',
    intro: data.sb_intro_color || '#89cff0',
    outro: data.sb_outro_color || '#f0e68c',
    preview: data.sb_preview_color || '#deb887',
    selfpromo: data.sb_selfpromo_color || '#dda0dd',
    exclusive_access: data.sb_exclusive_access_color || '#daa520',
    interaction: data.sb_interaction_color || '#ff9966',
    music_offtopic: data.sb_music_offtopic_color || '#b19cd9',
    filler: data.sb_filler_color || '#ffd1dc',
  };

  // Submission state
  let isMarking = false;
  let markStartTime = null;
  let markEndTime = null;

  function formatTimeHMS(seconds) {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return { hrs, mins, secs, ms, display: `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(ms).padStart(2, '0')}` };
  }

  function timeFromHMS(hrs, mins, secs, ms) {
    return (parseInt(hrs) || 0) * 3600 + (parseInt(mins) || 0) * 60 + (parseInt(secs) || 0) + (parseInt(ms) || 0) / 100;
  }

  function pad(num) { return String(num).padStart(2, '0'); }

  function createTimeInput(prefix, timeObj) {
    return `
      <div style="display: flex; gap: 6px; align-items: center;">
        <input type="number" id="${prefix}-hrs" value="${String(timeObj.hrs).padStart(2, '0')}" min="0" max="99" style="width: 65px; padding: 10px; border-radius: 6px; border: 1px solid var(--ctp-surface1, #45475a); background: var(--ctp-base, #1e1e2e); color: var(--ctp-text, #cdd6f4); font-family: monospace; text-align: center; font-size: 1.1rem;">
        <span style="color: var(--ctp-overlay2); font-size: 1.1rem;">:</span>
        <input type="number" id="${prefix}-mins" value="${String(timeObj.mins).padStart(2, '0')}" min="0" max="59" style="width: 65px; padding: 10px; border-radius: 6px; border: 1px solid var(--ctp-surface1, #45475a); background: var(--ctp-base, #1e1e2e); color: var(--ctp-text, #cdd6f4); font-family: monospace; text-align: center; font-size: 1.1rem;">
        <span style="color: var(--ctp-overlay2); font-size: 1.1rem;">:</span>
        <input type="number" id="${prefix}-secs" value="${String(timeObj.secs).padStart(2, '0')}" min="0" max="59" style="width: 65px; padding: 10px; border-radius: 6px; border: 1px solid var(--ctp-surface1, #45475a); background: var(--ctp-base, #1e1e2e); color: var(--ctp-text, #cdd6f4); font-family: monospace; text-align: center; font-size: 1.1rem;">
        <span style="color: var(--ctp-overlay2); font-size: 1.1rem;">:</span>
        <input type="number" id="${prefix}-ms" value="${String(timeObj.ms).padStart(2, '0')}" min="0" max="99" style="width: 65px; padding: 10px; border-radius: 6px; border: 1px solid var(--ctp-surface1, #45475a); background: var(--ctp-base, #1e1e2e); color: var(--ctp-text, #cdd6f4); font-family: monospace; text-align: center; font-size: 1.1rem;">
        <button type="button" class="sb-now-btn" data-target="${prefix}" style="padding: 10px 16px; border-radius: 6px; border: none; background: var(--ctp-surface1, #45475a); color: var(--ctp-text, #cdd6f4); cursor: pointer; margin-left: 8px; font-size: 1rem;">Now</button>
      </div>
    `;
  }

  function createSubmissionPopup(startTime, endTime) {
    const overlay = document.createElement('div');
    overlay.id = 'sb-submission-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0,0,0,0.7);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const popup = document.createElement('div');
    popup.style.cssText = `
      background: var(--ctp-surface0, #313244);
      color: var(--ctp-text, #cdd6f4);
      border-radius: 12px;
      padding: 24px;
      max-width: 650px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    `;

    const startObj = formatTimeHMS(startTime);
    const endObj = formatTimeHMS(endTime);

    popup.innerHTML = `
      <h3 style="margin: 0 0 20px 0; font-size: 1.2rem;">Submit Sponsor Segment</h3>

      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 500;">Start Time (HH:MM:SS:MS):</label>
        ${createTimeInput('sb-start', startObj)}
      </div>

      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 500;">End Time (HH:MM:SS:MS):</label>
        ${createTimeInput('sb-end', endObj)}
      </div>

      <div style="margin-bottom: 20px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 500;">Category:</label>
        <select id="sb-category" style="
          width: 100%;
          padding: 10px;
          border-radius: 8px;
          border: 1px solid var(--ctp-surface1, #45475a);
          background: var(--ctp-base, #1e1e2e);
          color: var(--ctp-text, #cdd6f4);
          font-size: 1rem;
        ">
          ${Object.entries(CATEGORY_INFO).map(([key, info]) => 
            `<option value="${key}">${info.label} - ${info.description}</option>`
          ).join('')}
        </select>
      </div>

      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button id="sb-cancel" style="
          padding: 10px 20px;
          border-radius: 8px;
          border: none;
          background: var(--ctp-surface1, #45475a);
          color: var(--ctp-text, #cdd6f4);
          cursor: pointer;
          font-size: 1rem;
        ">Cancel</button>
        <button id="sb-submit" style="
          padding: 10px 20px;
          border-radius: 8px;
          border: none;
          background: var(--ctp-blue, #89b4fa);
          color: var(--ctp-crust, #11111b);
          cursor: pointer;
          font-size: 1rem;
          font-weight: 500;
        ">Submit</button>
      </div>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    document.getElementById('sb-cancel').onclick = () => {
      document.body.removeChild(overlay);
    };

    overlay.onclick = (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    };

    document.querySelectorAll('.sb-now-btn').forEach(btn => {
      btn.onclick = () => {
        const target = btn.dataset.target;
        const t = formatTimeHMS(video_obj.currentTime);
        document.getElementById(`${target}-hrs`).value = String(t.hrs).padStart(2, '0');
        document.getElementById(`${target}-mins`).value = String(t.mins).padStart(2, '0');
        document.getElementById(`${target}-secs`).value = String(t.secs).padStart(2, '0');
        document.getElementById(`${target}-ms`).value = String(t.ms).padStart(2, '0');
      };
    });

    document.getElementById('sb-submit').onclick = async () => {
      const adjStartTime = timeFromHMS(
        document.getElementById('sb-start-hrs').value,
        document.getElementById('sb-start-mins').value,
        document.getElementById('sb-start-secs').value,
        document.getElementById('sb-start-ms').value
      );
      const adjEndTime = timeFromHMS(
        document.getElementById('sb-end-hrs').value,
        document.getElementById('sb-end-mins').value,
        document.getElementById('sb-end-secs').value,
        document.getElementById('sb-end-ms').value
      );
      
      if (adjEndTime <= adjStartTime) {
        showToast('End time must be after start time', 'error');
        return;
      }
      
      await submitSegment(adjStartTime, adjEndTime, document.getElementById('sb-category').value);
      document.body.removeChild(overlay);
    };
  }

  async function submitSegment(startTime, endTime, category) {
    const userID = getSponsorBlockUserID();
    const videoDuration = video_obj.duration || 0;

    const payload = {
      videoID: data.video_id,
      userID: userID,
      userAgent: 'Youtube-Local/1.0',
      videoDuration: videoDuration,
      segments: [{
        segment: [startTime, endTime],
        category: category,
        actionType: 'skip'
      }]
    };

    try {
      const response = await fetch('https://sponsor.ajay.app/api/skipSegments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const responseText = await response.text();
      
      if (response.ok) {
        let result;
        try {
          result = JSON.parse(responseText);
        } catch (e) {
          result = { success: true, message: 'Segment submitted' };
        }
        console.log('SponsorBlock: Segment submitted successfully', result);
        showToast('Segment submitted!', 'success');
      } else if (response.status === 409) {
        showToast('Segment already exists!', 'error');
      } else if (response.status === 429) {
        showToast('Rate limited. Please wait before submitting again.', 'error');
      } else {
        showToast('Failed to submit: HTTP ' + response.status, 'error');
      }
    } catch (err) {
      console.error('SponsorBlock: Error submitting segment:', err);
      showToast('Error: ' + err.message, 'error');
    }
  }

  function showToast(message, type) {
    const container = document.getElementById('toastContainer') || document.body;
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 24px;
      border-radius: 8px;
      background: ${type === 'success' ? '#a6d189' : type === 'error' ? '#f38ba8' : '#89b4fa'};
      color: #11111b;
      font-weight: 500;
      z-index: 100000;
      animation: sb-toast-in 0.3s ease;
    `;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'sb-toast-out 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function createMarkIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'sb-mark-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: var(--ctp-peach, #fab387);
      color: var(--ctp-crust, #11111b);
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 500;
      z-index: 9999;
      display: none;
    `;
    document.body.appendChild(indicator);
    return indicator;
  }

  const markIndicator = createMarkIndicator();

  function updateMarkIndicator() {
    if (isMarking && markStartTime !== null) {
      markIndicator.style.display = 'block';
      markIndicator.textContent = `Marking: ${formatTimeHMS(markStartTime).display} - ${formatTimeHMS(video_obj.currentTime).display}`;
    } else {
      markIndicator.style.display = 'none';
    }
  }

  // Keyboard shortcut for marking
  document.addEventListener('keydown', async (e) => {
    if (e.key === ';' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      // Ignore if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return;
      }

      if (!isMarking) {
        // Start marking - use preset time if available
        isMarking = true;
        markStartTime = window.sbStartMarking !== undefined ? window.sbStartMarking : video_obj.currentTime;
        markEndTime = null;
        window.sbStartMarking = undefined;
        updateMarkIndicator();
        console.log('SponsorBlock: Marking started at', markStartTime);
      } else {
        // Stop marking and show popup
        isMarking = false;
        markEndTime = video_obj.currentTime;
        markIndicator.style.display = 'none';
        
        if (markEndTime > markStartTime) {
          createSubmissionPopup(markStartTime, markEndTime);
        } else {
          showToast('Segment must be at least 1 second long', 'error');
        }
        
        markStartTime = null;
        markEndTime = null;
        console.log('SponsorBlock: Marking ended at', markEndTime);
      }
    }
  });

  // Update indicator during marking
  video_obj.addEventListener('timeupdate', () => {
    if (isMarking) {
      updateMarkIndicator();
    }
  });

  // Add CSS animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes sb-toast-in {
      from { opacity: 0; transform: translateX(-50%) translateY(20px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes sb-toast-out {
      from { opacity: 1; transform: translateX(-50%) translateY(0); }
      to { opacity: 0; transform: translateX(-50%) translateY(20px); }
    }
  `;
  document.head.appendChild(style);

  const url = `https://api.sponsor.ajay.app/api/searchSegments?videoID=${data.video_id}`;
  console.log("SponsorBlock: API URL:", url);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error("SponsorBlock: API request failed with status:", response.status);
      return;
    }
    const responseData = await response.json();
    console.log("SponsorBlock: Raw API response:", responseData);

    let segmentsToSkip = responseData.segments
      .filter((seg) => skipSettings[seg.category])
      .map((seg) => ({ 
        start: seg.startTime, 
        end: seg.endTime, 
        skipped: false,
        category: seg.category,
        color: colorSettings[seg.category] || '#a6d189'
      }));

    if (segmentsToSkip.length) {
      console.log("SponsorBlock: Segments to skip:", segmentsToSkip);

      const plyrProgress = document.querySelector('.plyr__progress');
      if (plyrProgress && video_obj.duration) {
        segmentsToSkip.forEach(seg => {
          const marker = document.createElement('div');
          const startPercent = (seg.start / video_obj.duration) * 100;
          const widthPercent = ((seg.end - seg.start) / video_obj.duration) * 100;

          marker.style.cssText = `
            position: absolute;
            left: ${startPercent}%;
            width: ${widthPercent}%;
            height: 100%;
            background-color: ${seg.color};
            opacity: 0.8;
            z-index: 0.8;
            pointer-events: none;
          `;
          plyrProgress.appendChild(marker);
          console.log(`SponsorBlock: Added marker from ${seg.start.toFixed(2)} to ${seg.end.toFixed(2)} (${seg.category})`);
        });
      }

      if (video_obj.currentTime < 1) {
        const firstSegment = segmentsToSkip.find(s => s.start < 1);
        if (firstSegment) {
          video_obj.currentTime = firstSegment.end;
          firstSegment.skipped = true;
          console.log(`SponsorBlock: Immediately skipped segment from ${firstSegment.start.toFixed(2)} to ${firstSegment.end.toFixed(2)}`);
        }
      }

      video_obj.addEventListener("timeupdate", function () {
        if (this.paused || this.seeking) return;
        const t = this.currentTime;
        const seg = segmentsToSkip.find((s) => t >= s.start && t < s.end && !s.skipped);

        if (seg) {
          seg.skipped = true;
          this.currentTime = seg.end;
          console.log(`SponsorBlock: Skipped segment from ${seg.start.toFixed(2)} to ${seg.end.toFixed(2)} (${seg.category})`);
        }

        segmentsToSkip.forEach(s => {
            if (t >= s.end && s.skipped) {
                s.skipped = false;
            }
        });
      });
    }
  } catch (err) {
    console.error("Error fetching SponsorBlock segments:", err);
  }
}

// Global function to start submission from button click
window.startSBSubmission = function() {
  const video_obj = Q("video");
  if (!video_obj) {
    console.error("SponsorBlock: No video found");
    return;
  }
  
  const currentTime = video_obj.currentTime;
  createSubmissionPopup(currentTime, currentTime + 10);
};

// Global function to handle keyboard shortcut and popup creation
window.load_sponsorblock_with_submission = load_sponsorblock;

window.addEventListener("DOMContentLoaded", load_sponsorblock);

