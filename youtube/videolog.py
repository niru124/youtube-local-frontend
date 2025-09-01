from youtube import yt_app, util, yt_data_extract, watch, db
from flask import request, render_template
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
    title = video_details.get('title', 'Unknown Title')
    link = video_details.get('url', f'{util.URL_ORIGIN}/watch?v={video_id}')
    channel_name = video_details.get('channel_name', 'Unknown Channel')
    channel_link = video_details.get('channel_link', '')

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
            if settings.download_thumbnails_for_videolog:
                video_details['thumbnail'] = util.prefix_url(info.get('thumbnail', ''))
            else:
                video_details['thumbnail'] = ''
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
            selected_date = datetime.datetime.strptime(selected_date_str, '%d-%m-%Y').date()
        except ValueError:
            selected_date = today # Fallback to today if date format is invalid
    else:
        selected_date = today

    if request.method == 'POST':
        video_url = request.form.get('video_url')
        if video_url:
            save_video_url(video_url)
            return {"status": "success", "message": "Video URL saved."}
        return {"status": "error", "message": "No video URL provided."}, 400
    else:
        video_urls_by_date = load_video_urls(selected_date)
        monthly_summary = db.get_monthly_summary(selected_date.year, selected_date.month)
        return render_template('videolog.html', video_urls_by_date=video_urls_by_date, monthly_summary=monthly_summary, util=util, selected_date=selected_date, timedelta=datetime.timedelta)







def save_video_url(url):
    if settings.enable_history_logging:
        match = re.search(r'v=([a-zA-Z0-9_-]{11})', url)
        if match:
            video_id = match.group(1)
            video_details = get_video_details(video_id)
            title = video_details.get('title', 'Unknown Title')
            link = video_details.get('url', f'{util.URL_ORIGIN}/watch?v={video_id}')
            channel_name = video_details.get('channel_name', 'Unknown Channel')
            channel_link = video_details.get('channel_link', '')
            
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
        for entry in daily_history:
            print(f"[DEBUG] Processing history entry: video_id={entry.get('video_id')}, title={entry.get('title')}, channel_name_db={entry.get('channel_name')}, watched_time_db={entry.get('watched_time')}, watch_percentage_db={entry.get('watch_time_percentage')}")
            thumbnail = ''
            if settings.download_thumbnails_for_videolog:
                video_details = get_video_details(entry['video_id'])
                thumbnail = video_details.get('thumbnail', '')

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
