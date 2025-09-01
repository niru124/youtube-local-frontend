from flask import Blueprint, render_template, request, redirect, url_for, jsonify
from youtube import db, util, yt_app, watch, settings
import os
import re

watch_later_bp = Blueprint('watch_later', __name__)

THUMBNAIL_DIR = os.path.join(settings.data_dir, 'watch_later_thumbnails')
os.makedirs(THUMBNAIL_DIR, exist_ok=True)

@watch_later_bp.route('/watch_later')
def watch_later_page():
    categories = db.get_watch_later_categories()
    selected_category = request.args.get('category')
    videos = db.get_watch_later_videos(selected_category)
    return render_template('watch_later.html', videos=videos, categories=categories, selected_category=selected_category, util=util)

@watch_later_bp.route('/watch_later/add', methods=['POST'])
def add_to_watch_later():
    video_url = request.form.get('video_url')
    category = request.form.get('category', '').strip()
    comment = request.form.get('comment', '').strip()

    if not video_url:
        return jsonify({"status": "error", "message": "Video URL is required."}), 400

    video_id = util.video_id(video_url)
    if not video_id:
        return jsonify({"status": "error", "message": "Invalid YouTube URL."}), 400

    # Fetch video details
    title = 'Unknown Title' # Initialize with fallback
    thumbnail_path = '' # Initialize thumbnail path

    try:
        info = watch.extract_info(video_id, use_invidious=False)
        if not info or info.get('error'):
            error_message = info.get('error', 'Unknown error from extract_info') if info else 'No info returned'
            return jsonify({"status": "error", "message": f"Could not fetch video details: {error_message}"}), 500
        title = info.get('title', 'Unknown Title')
    except Exception as e:
        return jsonify({"status": "error", "message": f"An error occurred while fetching video details: {str(e)}"}), 500

    if settings.download_thumbnails_for_videolog: # Reusing this setting for watch later as well
        try:
            if util.download_thumbnail(THUMBNAIL_DIR, video_id):
                thumbnail_path = os.path.join('/static/watch_later_thumbnails', video_id + '.jpg')
        except Exception as e:
            # Continue without thumbnail if download fails
            thumbnail_path = ''

    try:
        success = db.add_watch_later_video(video_id, title, video_url, category, comment, thumbnail_path)
        if success:
            return jsonify({"status": "success", "message": "Video added to Watch Later."})
        else:
            return jsonify({"status": "error", "message": "Video already in Watch Later or other DB error."}), 409
    except Exception as e:
        return jsonify({"status": "error", "message": f"An error occurred while adding video to Watch Later: {str(e)}"}), 500

@watch_later_bp.route('/watch_later/remove', methods=['POST'])
def remove_from_watch_later():
    video_id = request.form.get('video_id')
    if not video_id:
        return jsonify({"status": "error", "message": "Video ID is required."}), 400

    db.remove_watch_later_video(video_id)
    return jsonify({"status": "success", "message": "Video removed from Watch Later."})

@watch_later_bp.route('/watch_later/fetch_details')
def fetch_video_details():
    video_url = request.args.get('url')

    if not video_url:
        return jsonify({"status": "error", "message": "Video URL is required."}), 400

    video_id = util.video_id(video_url)
    if not video_id:
        return jsonify({"status": "error", "message": "Invalid YouTube URL."}), 400

    try:
        info = watch.extract_info(video_id, use_invidious=False)
        if not info or info.get('error'):
            error_message = info.get('error', 'Unknown error from extract_info') if info else 'No info returned'
            return jsonify({"status": "error", "message": f"Could not fetch video details: {error_message}"}), 500

        title = info.get('title', 'Unknown Title')

        thumbnail_downloaded = False
        if settings.download_thumbnails_for_videolog: # Reusing this setting
            if util.download_thumbnail(THUMBNAIL_DIR, video_id):
                thumbnail_downloaded = True

        thumbnail_url = ''
        if thumbnail_downloaded:
            thumbnail_url = url_for('static', filename=f'watch_later_thumbnails/{video_id}.jpg')
        else:
            thumbnail_url = url_for('static', filename='placeholder.jpg') # Assuming a placeholder.jpg exists

        return jsonify({"status": "success", "title": title, "thumbnail_url": thumbnail_url})

    except Exception as e:
        return jsonify({"status": "error", "message": f"An unexpected error occurred while fetching video details: {str(e)}"}), 500

@watch_later_bp.route('/watch_later/categories')
def get_categories():
    categories = db.get_watch_later_categories()
    return jsonify(categories)

@watch_later_bp.route('/watch_later/videos')
def get_videos():
    category = request.args.get('category')
    videos = db.get_watch_later_videos(category)
    # Adjust thumbnail paths for web access
    for video in videos:
        if video['thumbnail_path']:
            video['thumbnail_path'] = url_for('static', filename=f'watch_later_thumbnails/{video['video_id']}.jpg')
    return jsonify(videos)
