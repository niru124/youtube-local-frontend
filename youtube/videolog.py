from youtube import yt_app, util, yt_data_extract, watch, db
from flask import request, render_template, jsonify
import datetime
import os
import re
import gevent
import flask

from youtube import settings


@yt_app.route('/log_watch_time', methods=['POST'])
def log_watch_time():
    if not settings.enable_history_logging:
        return {"status": "error", "message": "History logging is disabled."}, 403

    data = request.get_json()
    video_id = data.get('video_id')
    watched_time = data.get('watched_time')
    total_duration = data.get('total_duration')

    if not all([video_id, watched_time is not None, total_duration is not None]):
        return {"status": "error", "message": "Missing data"}, 400

    # Fetch video details to get title, link, channel name
    video_details = get_video_details(video_id)
    title = video_details.get('title') or 'Unknown Title'
    link = video_details.get('url', f'{util.URL_ORIGIN}/watch?v={video_id}')
    channel_name = video_details.get('channel_name') or 'Unknown Channel'
    channel_link = video_details.get('channel_link') or ''

    try:
        db.log_video_watch_time(video_id, title, link, watched_time, total_duration, channel_name, channel_link)
        return {"status": "success", "message": "Watch time logged successfully"}
    except Exception as e:
        print(f"Error logging watch time to DB: {e}")
        return {"status": "error", "message": str(e)}, 500

def get_video_details(video_id):
    try:
        info = watch.extract_info(video_id, use_invidious=False)
        if info and not info.get('error'):
            video_details = {
                'id': video_id,
                'title': info.get('title', 'Unknown Title'),
                'url': util.URL_ORIGIN + '/watch?v=' + video_id,
                'channel_name': info.get('author', 'Unknown Channel'),
                'channel_link': info.get('author_url', '')
            }
            video_details['thumbnail'] = util.get_thumbnail_url(video_id)
            return video_details
    except Exception as e:
        print(f"Error fetching details for video {video_id}: {e}")
    return {
        'id': video_id,
        'title': 'Error loading title',
        'thumbnail': '',
        'url': util.URL_ORIGIN + '/watch?v=' + video_id
    }




@yt_app.route('/videolog', methods=['GET', 'POST'])
def videolog_page():
    today = datetime.date.today()
    selected_date_str = request.args.get('date')

    if selected_date_str:
        try:
            selected_date = datetime.datetime.strptime(selected_date_str, '%Y-%m-%d').date()
        except ValueError:
            selected_date = today # Fallback to today if date format is invalid
    else:
        selected_date = today

    if request.method == 'POST':
        action = request.form.get('action')
        if action == 'delete':
            video_id = request.form.get('video_id')
            if video_id:
                db.delete_video_from_history(video_id, selected_date)
                return {"status": "success", "message": "Video deleted from history."}
            return {"status": "error", "message": "No video ID provided."}, 400
        video_url = request.form.get('video_url')
        if video_url:
            save_video_url(video_url)
            return {"status": "success", "message": "Video URL saved."}
        return {"status": "error", "message": "No video URL provided."}, 400
    else:
        video_urls_by_date = load_video_urls(selected_date)
        monthly_summary = db.get_monthly_summary(selected_date.year, selected_date.month)
        daily_summary = db.get_daily_summary(selected_date)
        return render_template('videolog.html', video_urls_by_date=video_urls_by_date, monthly_summary=monthly_summary, daily_summary=daily_summary, util=util, selected_date=selected_date, timedelta=datetime.timedelta)





@yt_app.route('/videolog/export')
def export_history():
    export_format = request.args.get('format', 'txt')
    all_history = db.get_all_watch_history()

    if export_format == 'json':
        import json
        return flask.jsonify(all_history), 200, {'Content-Disposition': 'attachment;filename=watch_history.json'}
    else:
        content = ""
        for entry in all_history:
            content += f"Title: {entry.get('title', 'Unknown')}\n"
            content += f"URL: {entry.get('link', '')}\n"
            content += f"Channel: {entry.get('channel_name', 'Unknown Channel')}\n"
            content += f"Watched: {entry.get('watched_time', 0)}s ({entry.get('watch_time_percentage', 0)}%)\n"
            content += f"Date: {entry.get('date_logged', '')}\n"
            content += "-" * 50 + "\n"

        return content, 200, {
            'Content-Type': 'text/plain',
            'Content-Disposition': 'attachment;filename=watch_history.txt'
        }

@yt_app.route('/videolog/import', methods=['POST'])
def import_history():
    if 'history_file' not in request.files:
        return {"status": "error", "message": "No file provided"}, 400

    file = request.files['history_file']
    if file.filename == '':
        return {"status": "error", "message": "No file selected"}, 400

    try:
        content = file.read().decode('utf-8')
        lines = content.split('\n')
        imported_count = 0

        for i, line in enumerate(lines):
            line = line.strip()
            if not line or line.startswith('Title:'):
                title = ''
                url = ''
                channel_name = ''
                watched_time = 0
                total_duration = 0

                # Parse the entry
                for l in lines[i:i+10]:
                    if l.startswith('Title:'):
                        title = l.replace('Title:', '').strip()
                    elif l.startswith('URL:'):
                        url = l.replace('URL:', '').strip()
                    elif l.startswith('Channel:'):
                        channel_name = l.replace('Channel:', '').strip()
                    elif l.startswith('Watched:'):
                        watched_str = l.replace('Watched:', '').strip()
                        watched_time = int(watched_str.split('s')[0]) if 's' in watched_str else 0
                    elif l.startswith('-' * 50):
                        break

                # Extract video_id from URL
                if url:
                    match = re.search(r'v=([a-zA-Z0-9_-]{11})', url)
                    if match:
                        video_id = match.group(1)
                        channel_link = ''
                        try:
                            db.log_video_watch_time(video_id, title, url, watched_time, total_duration or 1, channel_name, channel_link)
                            imported_count += 1
                        except Exception as e:
                            print(f"Error importing entry: {e}")

        return {"status": "success", "message": f"Successfully imported {imported_count} entries"}
    except Exception as e:
        return {"status": "error", "message": f"Error reading file: {str(e)}"}, 500



def save_video_url(url):
    if settings.enable_history_logging:
        match = re.search(r'v=([a-zA-Z0-9_-]{11})', url)
        if match:
            video_id = match.group(1)
            video_details = get_video_details(video_id)
            title = video_details.get('title') or 'Unknown Title'
            link = video_details.get('url', f'{util.URL_ORIGIN}/watch?v={video_id}')
            channel_name = video_details.get('channel_name') or 'Unknown Channel'
            channel_link = video_details.get('channel_link') or ''
            
            # When a video is manually saved, we don't have actual watch time, so log with 0
            db.log_video_watch_time(video_id, title, link, 0, 0, channel_name, channel_link)
        else:
            print(f"Warning: Could not extract video ID from URL: {url}")

def load_video_urls(date_obj):

    video_urls_by_date = {}
    print(f"[DEBUG] load_video_urls called for date: {date_obj}")

    daily_history = db.get_daily_watch_history(date_obj)
    print(f"[DEBUG] db.get_daily_watch_history returned {len(daily_history)} entries.")
    if daily_history:
        video_urls_by_date[date_obj] = []
        video_ids = [entry['video_id'] for entry in daily_history]
        thumbnails = {}

        if settings.download_thumbnails_for_videolog:
            def fetch_thumb(vid):
                try:
                    info = watch.extract_info(vid, use_invidious=False)
                    if info and not info.get('error'):
                        thumbnails[vid] = util.get_thumbnail_url(vid)
                    else:
                        thumbnails[vid] = ''
                except Exception as e:
                    print(f"Error fetching thumbnail for {vid}: {e}")
                    thumbnails[vid] = ''

            jobs = [gevent.spawn(fetch_thumb, vid) for vid in video_ids]
            gevent.joinall(jobs)
        else:
            for vid in video_ids:
                thumbnails[vid] = ''

        for entry in daily_history:
            print(f"[DEBUG] Processing history entry: video_id={entry.get('video_id')}, title={entry.get('title')}, channel_name_db={entry.get('channel_name')}, watched_time_db={entry.get('watched_time')}, watch_percentage_db={entry.get('watch_time_percentage')}")

            thumbnail = thumbnails.get(entry['video_id'], '')

            video_urls_by_date[date_obj].append({
                'id': entry['video_id'],
                'title': entry['title'],
                'thumbnail': thumbnail,
                'url': entry['link'],
                'watched_time': entry['watched_time'],
                'watch_time_percentage': entry['watch_time_percentage'],
                'channel_name': entry.get('channel_name', 'Unknown Channel'),
                'channel_link': entry.get('channel_link', '').replace('https://www.youtube.com', '')
            })

    return video_urls_by_date
