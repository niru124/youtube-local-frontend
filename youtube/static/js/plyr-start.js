var captionsActive;
if(data.settings.subtitles_mode == 2)
    captionsActive = true;
else if(data.settings.subtitles_mode == 1 && data.has_manual_captions)
    captionsActive = true;
else if(data.subtitle_sources && data.subtitle_sources.length > 0)
    captionsActive = true;
else
    captionsActive = false;

var qualityOptions = [];
var qualityDefault;
for (var src of data['uni_sources']) {
    qualityOptions.push(src.quality_string)
}
for (var src of data['pair_sources']) {
    qualityOptions.push(src.quality_string)
}
if (data['using_pair_sources'])
    qualityDefault = data['pair_sources'][data['pair_idx']].quality_string;
else if (data['uni_sources'].length != 0)
    qualityDefault = data['uni_sources'][data['uni_idx']].quality_string;
else
    qualityDefault = 'None';



// Fix plyr refusing to work with qualities that are strings
Object.defineProperty(Plyr.prototype, 'quality', {
    set: function(input) {
      const config = this.config.quality;
      const options = this.options.quality;

      if (!options.length) {
        return;
      }

      // removing this line:
      //let quality = [!is.empty(input) && Number(input), this.storage.get('quality'), config.selected, config.default].find(is.number);
      // replacing with:
      quality = input;
      let updateStorage = true;

      if (!options.includes(quality)) {
        // Plyr sets quality to null at startup, resulting in the erroneous
        // calling of this setter function with input = null, and the
        // commented out code below would set the quality to something
        // unrelated at startup. Comment out and just return.
        return;
        /*const value = closest(options, quality);
        this.debug.warn(`Unsupported quality option: ${quality}, using ${value} instead`);
        quality = value; // Don't update storage if quality is not supported

        updateStorage = false;*/
      } // Update config


      config.selected = quality; // Set quality

      this.media.quality = quality; // Save to storage

      if (updateStorage) {
        this.storage.set({
          quality
        });
      }
    }
});

var markers = {
    enabled: false,
    points: [],
};

if (typeof video_chapters !== 'undefined' && video_chapters && video_chapters.length > 0) {
    markers.enabled = true;
    markers.points = video_chapters.map(function(chapter) {
        return {
            time: chapter.start_time,
            label: chapter.title,
        };
    });
}

const playerOptions = {
    disableContextMenu: false,
    markers: markers,
    captions: {
        active: captionsActive,
        language: data.settings.subtitles_language,
    },
    controls: [
        'play-large',
        'play',
        'progress',
        'current-time',
        'duration',
        'mute',
        'volume',
        'captions',
        'settings',
        'fullscreen',
    ],
    iconUrl: "/youtube.com/static/modules/plyr/plyr.svg",
    blankVideo: "/youtube.com/static/modules/plyr/blank.webm",
    debug: false,
    storage: {enabled: false},
    // disable plyr hotkeys in favor of hotkeys.js
    keyboard: {
        focused: false,
        global: false,
    },
    quality: {
        default: qualityDefault,
        options: qualityOptions,
        forced: true,
        onChange: function(quality) {
            if (quality == 'None')
                return;
            if (quality.includes('(integrated)')) {
                for (var i=0; i < data['uni_sources'].length; i++) {
                    if (data['uni_sources'][i].quality_string == quality) {
                        changeQuality({'type': 'uni', 'index': i});
                        return;
                    }
                }
            } else {
                for (var i=0; i < data['pair_sources'].length; i++) {
                    if (data['pair_sources'][i].quality_string == quality) {
                        changeQuality({'type': 'pair', 'index': i});
                        return;
                    }
                }
            }
        },
    },
    speed: {
        selected: 2,
        options: [0.5, 1, 1.25, 1.5, 2, 3, 4],
    },

    previewThumbnails: {
        enabled: storyboard_url != null,
        src: [storyboard_url],
    },

    settings: ['captions', 'quality', 'speed', 'loop'],
}

if (data.settings.default_volume !== -1) {
    playerOptions.volume = 0.5;
}

const player = new Plyr(document.querySelector('video'), playerOptions);

// Add chapter markers to the progress bar
if (markers.enabled) {
    console.log('Markers enabled, points:', markers.points);

    function addMarkers() {
        var progress = player.elements.progress;
        console.log('addMarkers called, progress:', progress);
        if (!progress) return;
        var old = progress.querySelectorAll('.plyr__progress__marker');
        old.forEach(function(el) { el.remove(); });
        var duration = player.media.duration;
        console.log('Duration:', duration);
        if (!duration || isNaN(duration) || duration <= 0) return;

        markers.points.forEach(function(point) {
            if (point.time <= 0 || point.time >= duration) {
                console.log('Skipping point:', point.time, '>=', duration);
                return;
            }
            var pct = (point.time / duration * 100);
            console.log('Adding marker for:', point.label, 'at', point.time, 's (', pct, '%)');

            var marker = document.createElement('span');
            marker.className = 'plyr__progress__marker';
            marker.style.position = 'absolute';
            marker.style.left = pct + '%';
            marker.style.top = '0';
            marker.style.bottom = '0';
            marker.style.width = '3px';
            marker.style.background = '#fff';
            marker.style.borderRadius = '1px';
            marker.style.cursor = 'pointer';
            marker.style.zIndex = '5';

            marker.addEventListener('click', function() {
                player.currentTime = point.time;
            });

            progress.appendChild(marker);
        });
    }

    player.on('loadedmetadata', addMarkers);
    player.on('durationchange', addMarkers);

    // Chapter label - inside player container so it works in fullscreen
    var chapterLabel = document.createElement('div');
    chapterLabel.id = 'plyr-chapter-label';
    chapterLabel.style.position = 'absolute';
    chapterLabel.style.left = '10px';
    chapterLabel.style.right = '10px';
    chapterLabel.style.transform = 'none';
    chapterLabel.style.background = 'rgba(0,0,0,0.85)';
    chapterLabel.style.color = '#fff';
    chapterLabel.style.padding = '6px 14px';
    chapterLabel.style.borderRadius = '4px';
    chapterLabel.style.fontSize = '13px';
    chapterLabel.style.fontWeight = '500';
    chapterLabel.style.whiteSpace = 'normal';
    chapterLabel.style.maxWidth = 'calc(100% - 20px)';
    chapterLabel.style.textAlign = 'left';
    chapterLabel.style.lineHeight = '1.4';
    chapterLabel.style.zIndex = '99';
    chapterLabel.style.pointerEvents = 'none';
    chapterLabel.style.display = 'none';
    chapterLabel.style.transition = 'opacity 0.2s';
    chapterLabel.style.bottom = '45px';

    // Append to player container (goes into fullscreen with the player)
    player.elements.container.style.position = 'relative';
    player.elements.container.appendChild(chapterLabel);

    var currentChapter = null;
    var hideTimeout = null;

    function showChapterForTime(t) {
        var found = null;
        for (var i = markers.points.length - 1; i >= 0; i--) {
            if (t >= markers.points[i].time) {
                found = markers.points[i];
                break;
            }
        }

        if (found) {
            chapterLabel.textContent = found.label;
            chapterLabel.style.display = 'block';
            chapterLabel.style.opacity = '1';
            // Position above the controls
            var controls = player.elements.controls;
            if (controls) {
                var rect = controls.getBoundingClientRect();
                chapterLabel.style.top = (rect.top - 40) + 'px';
            }
        } else {
            chapterLabel.style.display = 'none';
        }
    }

    function hideChapter() {
        chapterLabel.style.display = 'none';
        currentChapter = null;
    }

    // Show chapter on hover over progress area
    var seekInput = player.elements.inputs.seek;
    if (seekInput) {
        seekInput.addEventListener('mousemove', function(e) {
            var rect = seekInput.getBoundingClientRect();
            var pct = ((e.clientX - rect.left) / rect.width) * 100;
            var t = (pct / 100) * player.media.duration;
            showChapterForTime(t);
        });
        seekInput.addEventListener('mouseleave', hideChapter);
    }

    // Also show chapter during playback (auto-hide after 4s)
    player.on('timeupdate', function() {
        var t = player.currentTime;
        var found = null;
        for (var i = markers.points.length - 1; i >= 0; i--) {
            if (t >= markers.points[i].time) {
                found = markers.points[i];
                break;
            }
        }

        if (found !== currentChapter) {
            currentChapter = found;
            if (found) {
                showChapterForTime(t);
                clearTimeout(hideTimeout);
                hideTimeout = setTimeout(hideChapter, 4000);
            } else {
                hideChapter();
            }
        }
    });

    player.on('seeked', function() {
        showChapterForTime(player.currentTime);
        clearTimeout(hideTimeout);
        hideTimeout = setTimeout(hideChapter, 4000);
    });

    player.on('play', function() {
        showChapterForTime(player.currentTime);
        clearTimeout(hideTimeout);
        hideTimeout = setTimeout(hideChapter, 4000);
    });
}

// disable double click to fullscreen
// https://github.com/sampotts/plyr/issues/1370#issuecomment-528966795
player.eventListeners.forEach(function(eventListener) {
    if(eventListener.type === 'dblclick') {
        eventListener.element.removeEventListener(eventListener.type, eventListener.callback, eventListener.options);
    }
});

// Add .started property, true after the playback has been started
// Needed so controls won't be hidden before playback has started
player.started = false;
player.once('playing', function(){this.started = true});
