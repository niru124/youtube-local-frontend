from flask import Blueprint, render_template, request, redirect, url_for, jsonify
from youtube import db, util, yt_app, watch, settings
import re

watch_later_bp = Blueprint('watch_later', __name__)

@watch_later_bp.route('/watch_later')
def watch_later_page():
    categories = db.get_watch_later_categories()
    selected_category = request.args.get('category')
    videos = db.get_watch_later_videos(selected_category)
    # Set thumbnail paths to YouTube URLs
    for video in videos:
        video['thumbnail_path'] = util.get_thumbnail_url(video['video_id'])
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

    try:
        info = watch.extract_info(video_id, use_invidious=False)
        if not info or info.get('error'):
            error_message = info.get('error', 'Unknown error from extract_info') if info else 'No info returned'
            return jsonify({"status": "error", "message": f"Could not fetch video details: {error_message}"}), 500
        title = info.get('title', 'Unknown Title')
    except Exception as e:
        return jsonify({"status": "error", "message": f"An error occurred while fetching video details: {str(e)}"}), 500

    thumbnail_path = util.get_thumbnail_url(video_id)

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

@watch_later_bp.route('/watch_later/update_comment', methods=['POST'])
def update_comment():
    video_id = request.form.get('video_id')
    comment = request.form.get('comment', '').strip()

    if not video_id:
        return jsonify({"status": "error", "message": "Video ID is required."}), 400

    db.update_watch_later_comment(video_id, comment)
    return jsonify({"status": "success", "message": "Comment updated successfully."})

@watch_later_bp.route('/watch_later/fetch_details', methods=['POST'])
def fetch_video_details():
    video_url = request.form.get('url')

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

        thumbnail_url = util.get_thumbnail_url(video_id)

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
    # Set thumbnail paths to YouTube URLs
    for video in videos:
        video['thumbnail_path'] = util.get_thumbnail_url(video['video_id'])
    return jsonify(videos)
