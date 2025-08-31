"use strict";

// from: https://git.gir.st/subscriptionfeed.git/blob/59a590d:/app/youtube/templates/watch.html.j2#l28

var sha256 = function a(b) { function c(a, b) { return a >>> b | a << 32 - b } for (var d, e, f = Math.pow, g = f(2, 32), h = "length", i = "", j = [], k = 8 * b[h], l = a.h = a.h || [], m = a.k = a.k || [], n = m[h], o = {}, p = 2; 64 > n; p++)if (!o[p]) { for (d = 0; 313 > d; d += p)o[d] = p; l[n] = f(p, .5) * g | 0, m[n++] = f(p, 1 / 3) * g | 0 } for (b += "\x80"; b[h] % 64 - 56;)b += "\x00"; for (d = 0; d < b[h]; d++) { if (e = b.charCodeAt(d), e >> 8) return; j[d >> 2] |= e << (3 - d) % 4 * 8 } for (j[j[h]] = k / g | 0, j[j[h]] = k, e = 0; e < j[h];) { var q = j.slice(e, e += 16), r = l; for (l = l.slice(0, 8), d = 0; 64 > d; d++) { var s = q[d - 15], t = q[d - 2], u = l[0], v = l[4], w = l[7] + (c(v, 6) ^ c(v, 11) ^ c(v, 25)) + (v & l[5] ^ ~v & l[6]) + m[d] + (q[d] = 16 > d ? q[d] : q[d - 16] + (c(s, 7) ^ c(s, 18) ^ s >>> 3) + q[d - 7] + (c(t, 17) ^ c(t, 19) ^ t >>> 10) | 0), x = (c(u, 2) ^ c(u, 13) ^ c(u, 22)) + (u & l[1] ^ u & l[2] ^ l[1] & l[2]); l = [w + x | 0].concat(l), l[4] = l[4] + w | 0 } for (d = 0; 8 > d; d++)l[d] = l[d] + r[d] | 0 } for (d = 0; 8 > d; d++)for (e = 3; e + 1; e--) { var y = l[d] >> 8 * e & 255; i += (16 > y ? 0 : "") + y.toString(16) } return i }; /*https://geraintluff.github.io/sha256/sha256.min.js (public domain)*/

window.load_sponsorblock = async function() {
  const video_obj = Q("video");
  if (!video_obj) return;

  if (!window.data || !data.video_id) {
    console.error("SponsorBlock: data.video_id is not defined.");
    return;
  }

  console.log("SponsorBlock: Video ID:", data.video_id);

  const skipCategories = [
    "sponsor",
    "intro",
    "outro",
    "preview",
    "selfpromo",
    "exclusive_access",
    "interaction",
    "music_offtopic",
    "filler",
  ];

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
      .filter((seg) => skipCategories.includes(seg.category))
      .map((seg) => ({ start: seg.startTime, end: seg.endTime, skipped: false }));

    if (segmentsToSkip.length) {
      console.log("SponsorBlock: Segments to skip:", segmentsToSkip);

      // Add visual markers to the Plyr timeline
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
            background-color:#a6d189; /* Distinct color for markers */
            opacity: 1;
            z-index: 0.8;
            pointer-events: none; /* Allow clicks to pass through to the actual progress bar */
          `;
          plyrProgress.appendChild(marker);
          console.log(`SponsorBlock: Added marker from ${seg.start.toFixed(2)} to ${seg.end.toFixed(2)}`);
        });
      } else if (!plyrProgress) {
        console.warn("SponsorBlock: Plyr progress bar not found for adding markers.");
      } else if (!video_obj.duration) {
        console.warn("SponsorBlock: Video duration not available for adding markers.");
      }

      // Attempt immediate skip if video hasn't started or is at the very beginning
      if (video_obj.currentTime < 1) { // Check if current time is near 0
        const firstSegment = segmentsToSkip.find(s => s.start < 1); // Find a segment starting near 0
        if (firstSegment) {
          video_obj.currentTime = firstSegment.end;
          firstSegment.skipped = true;
          console.log(`SponsorBlock: Immediately skipped segment from ${firstSegment.start.toFixed(2)} to ${firstSegment.end.toFixed(2)}`);
        }
      }

      video_obj.addEventListener("timeupdate", function () {
        // console.log("SponsorBlock: timeupdate fired, current time:", this.currentTime);
        if (this.paused || this.seeking) return; // Don't skip if paused or seeking
        const t = this.currentTime;
        // Find a segment that is currently active and hasn't been skipped yet
        const seg = segmentsToSkip.find((s) => t >= s.start && t < s.end && !s.skipped);

        if (seg) {
          // Mark segment as skipped to prevent re-skipping
          seg.skipped = true;
          this.currentTime = seg.end;
          console.log(`SponsorBlock: Skipped segment from ${seg.start.toFixed(2)} to ${seg.end.toFixed(2)}`);
        }

        // Reset skipped flag for segments that have been passed
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

window.addEventListener("DOMContentLoaded", load_sponsorblock);

