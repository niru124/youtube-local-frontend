from flask import Blueprint, render_template, request, jsonify, make_response
from youtube import util, yt_app
import json
import os

shortcuts_bp = Blueprint('shortcuts', __name__)

DEFAULT_SHORTCUTS = {
    'play_pause': 'k',
    'seek_back_5': 'arrowleft',
    'seek_forward_5': 'arrowright',
    'seek_back_10': 'j',
    'seek_forward_10': 'l',
    'seek_back_30': 'arrowdown',
    'seek_forward_30': 'arrowup',
    'volume_up': '0',
    'volume_down': '9',
    'speed_up': ']',
    'speed_down': '[',
    'fullscreen': 'f',
    'mute': 'm',
    'loop': 'g',
    'screenshot': 's',
    'copy_timestamp': 't',
    'save_note': 'x',
    'record_clip': 'c',
    'jump_to_time': 'ctrl+g'
}

SHORTCUT_LABELS = {
    'play_pause': 'Play/Pause',
    'seek_back_5': 'Seek Back 5s',
    'seek_forward_5': 'Seek Forward 5s',
    'seek_back_10': 'Seek Back 10s',
    'seek_forward_10': 'Seek Forward 10s',
    'seek_back_30': 'Seek Back 30s',
    'seek_forward_30': 'Seek Forward 30s',
    'volume_up': 'Volume Up',
    'volume_down': 'Volume Down',
    'speed_up': 'Speed Up',
    'speed_down': 'Speed Down',
    'fullscreen': 'Fullscreen',
    'mute': 'Mute/Unmute',
    'loop': 'Toggle Loop',
    'screenshot': 'Screenshot',
    'copy_timestamp': 'Copy Timestamp Link',
    'save_note': 'Save Note',
    'record_clip': 'Record Clip',
    'jump_to_time': 'Jump to Time'
}

SHORTCUTS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'shortcuts.json')

def load_shortcuts():
    if os.path.exists(SHORTCUTS_FILE):
        try:
            with open(SHORTCUTS_FILE, 'r') as f:
                return json.load(f)
        except:
            pass
    return DEFAULT_SHORTCUTS.copy()

def save_shortcuts(shortcuts):
    os.makedirs(os.path.dirname(SHORTCUTS_FILE), exist_ok=True)
    with open(SHORTCUTS_FILE, 'w') as f:
        json.dump(shortcuts, f, indent=2)

@shortcuts_bp.route('/shortcuts')
def shortcuts_page():
    shortcuts = load_shortcuts()
    return render_template('shortcuts.html', 
                           shortcuts=shortcuts, 
                           labels=SHORTCUT_LABELS,
                           util=util)

@shortcuts_bp.route('/shortcuts/save', methods=['POST'])
def save_shortcuts_route():
    data = request.get_json()
    if data:
        save_shortcuts(data)
        response = make_response(jsonify({'status': 'success'}))
        response.content_type = 'application/json'
        return response
    response = make_response(jsonify({'status': 'error'}))
    response.content_type = 'application/json'
    return response, 400

@shortcuts_bp.route('/shortcuts/reset', methods=['POST'])
def reset_shortcuts():
    save_shortcuts(DEFAULT_SHORTCUTS.copy())
    response = make_response(jsonify({'status': 'success'}))
    response.content_type = 'application/json'
    return response

@shortcuts_bp.route('/shortcuts/json')
def get_shortcuts_json():
    shortcuts = load_shortcuts()
    response = make_response(jsonify(shortcuts))
    response.content_type = 'application/json'
    return response
