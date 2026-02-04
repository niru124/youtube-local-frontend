from youtube import util, db
import flask
from flask import request
import jinja2
import settings
import traceback
import re
from sys import exc_info
yt_app = flask.Flask(__name__)
yt_app.url_map.strict_slashes = False
# yt_app.jinja_env.trim_blocks = True
# yt_app.jinja_env.lstrip_blocks = True

# https://stackoverflow.com/questions/39858191/do-statement-not-working-in-jinja
yt_app.jinja_env.add_extension('jinja2.ext.do') # why

yt_app.add_url_rule('/settings', 'settings_page', settings.settings_page, methods=['POST', 'GET'])

@yt_app.route('/')
def homepage():
    return flask.render_template('home.html', title="Youtube local")

@yt_app.route('/homepage')
def homepage_route():
    if not settings.enable_homepage:
        flask.abort(404)
    import gevent
    from youtube import watch
    import re
    layout = request.args.get('layout', 'list')  # default to list
    num = int(request.args.get('num', 20))
    if num > 50:  # limit to 50
        num = 50
    video_url = request.args.get('video_url')
    searched_related = None
    if video_url:
        match = re.search(r'v=([a-zA-Z0-9_-]{11})', video_url)
        if match:
            video_id = match.group(1)
            try:
                info = watch.extract_info(video_id, use_invidious=False)
                related = info.get('related_videos', [])
                for rel in related:
                    rel['url'] = f'/youtube.com/watch?v={rel["id"]}'
                    rel['thumbnail'] = util.get_thumbnail_url(rel['id'])
                    if rel.get('author_url'):
                        rel['author_url'] = rel['author_url'].replace('https://www.youtube.com', '/youtube.com')
                searched_related = related
            except Exception as e:
                print(f"Error fetching related for {video_id}: {e}")
                searched_related = []
    recent_videos = db.get_recent_videos(num)
    videos_with_related = []

    def fetch_related(vid):
        vid['thumbnail'] = util.get_thumbnail_url(vid['video_id'])
        try:
            info = watch.extract_info(vid['video_id'], use_invidious=False)
            related = info.get('related_videos', [])
            for rel in related:
                rel['url'] = f'/youtube.com/watch?v={rel["id"]}'
                rel['thumbnail'] = util.get_thumbnail_url(rel['id'])
                if rel.get('author_url'):
                    rel['author_url'] = rel['author_url'].replace('https://www.youtube.com', '/youtube.com')
            return {
                'video': vid,
                'related': related
            }
        except Exception as e:
            print(f"Error fetching related for {vid['video_id']}: {e}")
            return {
                'video': vid,
                'related': []
            }

    if searched_related is not None:
        videos_with_related = [{'video': {'title': 'Searched Video Related', 'video_id': '', 'channel_name': ''}, 'related': searched_related}]
    else:
        jobs = [gevent.spawn(fetch_related, vid) for vid in recent_videos]
        gevent.joinall(jobs)
        videos_with_related = [job.value for job in jobs]
    return flask.render_template('homepage.html', videos_with_related=videos_with_related, layout=layout, num=num, host_url=request.host_url, searched=searched_related is not None, title="Homepage")


theme_names = {
    0: 'light_theme',
    1: 'gray_theme',
    2: 'dark_theme',
}

@yt_app.context_processor
def inject_theme_preference():
    return {
        'theme_path': '/youtube.com/static/' + theme_names[settings.theme] + '.css',
        'settings': settings,
    }

@yt_app.template_filter('commatize')
def commatize(num):
    if num is None:
        return ''
    if isinstance(num, str):
        try:
            num = int(num)
        except ValueError:
            return num
    return '{:,}'.format(num)

def timestamp_replacement(match):
    time_seconds = 0
    for part in match.group(0).split(':'):
        time_seconds = 60*time_seconds + int(part)
    return (
        '<a href="#" onclick="jumpToTime(\'' + match.group(0) + '\', document.querySelector(\'video\')); updateOSD(\'Jumped to ' + match.group(0) + '\'); return false;">'
        + match.group(0)
        + '</a>'
    )

TIMESTAMP_RE = re.compile(r'\b(\d?\d:)?\d?\d:\d\d\b')
@yt_app.template_filter('timestamps')
def timestamps(text):
    return TIMESTAMP_RE.sub(timestamp_replacement, text)

@yt_app.errorhandler(500)
def error_page(e):
    slim = request.args.get('slim', False) # whether it was an ajax request
    if (exc_info()[0] == util.FetchError
        and exc_info()[1].code == '429'
        and settings.route_tor
    ):
        error_message = ('Error: Youtube blocked the request because the Tor'
            ' exit node is overutilized. Try getting a new exit node by'
            ' using the New Identity button in the Tor Browser.')
        if exc_info()[1].error_message:
            error_message += '\n\n' + exc_info()[1].error_message
        if exc_info()[1].ip:
            error_message += '\n\nExit node IP address: ' + exc_info()[1].ip
        return flask.render_template('error.html', error_message=error_message, slim=slim), 502
    elif exc_info()[0] == util.FetchError and exc_info()[1].error_message:
        return (flask.render_template(
                    'error.html',
                    error_message=exc_info()[1].error_message,
                    slim=slim
                ), 502)
    return flask.render_template('error.html', traceback=traceback.format_exc(), slim=slim), 500

font_choices = {
    0: 'initial',
    1: 'arial, "liberation sans", sans-serif',
    2: '"liberation serif", "times new roman", calibri, carlito, serif',
    3: 'verdana, sans-serif',
    4: 'tahoma, sans-serif',
}

@yt_app.route('/shared.css')
def get_css():
    return flask.Response(
        flask.render_template('shared.css',
            font_family = font_choices[settings.font]
        ),
        mimetype='text/css',
    )


# This is okay because the flask urlize function puts the href as the first
# property
YOUTUBE_LINK_RE = re.compile(r'<a href="(' + util.YOUTUBE_URL_RE_STR + ')"')
old_urlize = jinja2.filters.urlize
def prefix_urlize(*args, **kwargs):
    result = old_urlize(*args, **kwargs)
    return YOUTUBE_LINK_RE.sub(r'<a href="/\1"', result)
jinja2.filters.urlize = prefix_urlize

@yt_app.route('/history/search')
def search_history_page():
    from youtube import db, videolog, util
    query = request.args.get('q', '')
    page = request.args.get('page', '1')
    try:
        page = int(page)
        if page < 1:
            page = 1
    except (ValueError, TypeError):
        page = 1

    limit = 24
    offset = (page - 1) * limit

    if not query or not query.strip():
        return flask.render_template('history_search.html', results=[], count=0, query='', page=1, total_pages=0, limit=limit, util=util)

    raw_results, total_count = db.search_all_history(query, limit=limit * 5, offset=0)

    seen_video_ids = set()
    processed_results = []

    for result in raw_results:
        video_id = result.get('video_id')
        if video_id and video_id not in seen_video_ids:
            seen_video_ids.add(video_id)

            watched_time = result.get('watched_time', 0) or 0
            watch_percentage = result.get('watch_time_percentage', 0) or 0

            try:
                date_logged = result.get('date_logged', '')
                if date_logged:
                    day, month, year = date_logged.split('_')
                    formatted_date = f"{day}/{month}/{year}"
                else:
                    formatted_date = ''
            except (ValueError, AttributeError):
                formatted_date = ''

            resume_link = f"{util.URL_ORIGIN}/watch?v={video_id}&t={int(watched_time)}s"
            
            channel_link = result.get('channel_link', '')
            if not channel_link and result.get('channel_name'):
                channel_link = f"{util.URL_ORIGIN}/youtube.com/@{result.get('channel_name').replace(' ', '_')}"

            processed_results.append({
                'video_id': video_id,
                'title': result.get('title', 'Unknown Title'),
                'link': resume_link,
                'watched_time': round(watched_time / 60, 1),
                'watch_time_percentage': round(watch_percentage, 1),
                'channel_name': result.get('channel_name', ''),
                'channel_link': channel_link,
                'date': formatted_date,
                'score': result.get('score', 0)
            })

    processed_results.sort(key=lambda x: (-x['score']))

    paginated_results = processed_results[offset:offset + limit]
    total_pages = (len(processed_results) + limit - 1) // limit if processed_results else 0

    return flask.render_template('history_search.html', results=paginated_results, count=len(processed_results), query=query, page=page, total_pages=total_pages, limit=limit, util=util)

