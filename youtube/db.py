import sqlite3
import datetime
import os

from youtube import settings

DATABASE_FILE = os.path.join(settings.data_dir, 'youtube_history.db')
print(f"[DEBUG] Database file path: {DATABASE_FILE}")

def get_db_connection():
    # Ensure the directory for the database file exists
    os.makedirs(os.path.dirname(DATABASE_FILE), exist_ok=True)
    conn = sqlite3.connect(DATABASE_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def create_daily_table(date_obj):
    table_name = date_obj.strftime("daily_%d_%m_%Y")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {table_name} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id TEXT NOT NULL,
            title TEXT NOT NULL,
            link TEXT NOT NULL,
            watched_time REAL NOT NULL,
            channel_name TEXT,
            channel_link TEXT,
            watch_time_percentage REAL NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def create_monthly_table(month_year_str):
    table_name = f"monthly_{month_year_str.replace('-', '_')}"
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {table_name} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            total_hours_watched REAL NOT NULL,
            most_watched_channel TEXT,
            most_watched_date TEXT,
            most_watched_date_time REAL,
            top_channels TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def log_video_watch_time(video_id, title, link, watched_time, total_duration, channel_name=None, channel_link=None):
    today_obj = datetime.date.today()
    month_year_str = today_obj.strftime('%m_%Y')

    create_daily_table(today_obj)
    create_monthly_table(month_year_str)

    watch_time_percentage = (watched_time / total_duration) * 100 if total_duration > 0 else 0

    conn = get_db_connection()
    cursor = conn.cursor()

    daily_table_name = today_obj.strftime("daily_%d_%m_%Y")

    # Check if video already exists for today
    cursor.execute(f"SELECT id, watched_time FROM {daily_table_name} WHERE video_id = ?", (video_id,))
    existing_entry = cursor.fetchone()

    if existing_entry:
        # Update existing entry
        new_watched_time = watched_time # Assuming watched_time here is the total watched time for the session
        cursor.execute(f"""
            UPDATE {daily_table_name}
            SET watched_time = ?,
                watch_time_percentage = ?,
                timestamp = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (new_watched_time, watch_time_percentage, existing_entry['id']))
    else:
        # Insert new entry
        cursor.execute(f"""
            INSERT INTO {daily_table_name}
            (video_id, title, link, watched_time, channel_name, channel_link, watch_time_percentage)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (video_id, title, link, watched_time, channel_name, channel_link, watch_time_percentage))
    
    conn.commit()
    conn.close()
    
    # Update monthly summary (this will be a more complex aggregation, for now just a placeholder)
    update_monthly_summary(datetime.date.today().year, datetime.date.today().month)

def update_monthly_summary(year, month):
    month_year_str = f"{month:02d}_{year}"
    monthly_table_name = f"monthly_{month_year_str}"
    
    conn = get_db_connection()
    cursor = conn.cursor()

    total_watched_time_seconds = 0
    channel_watch_times = {}
    date_watch_times = {}

    # Generate all possible daily table names for the current month
    start_date = datetime.date(year, month, 1)
    end_date = datetime.date(year, month, 1) + datetime.timedelta(days=32)
    end_date = end_date.replace(day=1) - datetime.timedelta(days=1)

    current_date = start_date
    while current_date <= end_date:
        daily_table_name = current_date.strftime("daily_%d_%m_%Y")
        
        # Check if the daily table exists
        cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{daily_table_name}'")
        if cursor.fetchone():
            # Calculate total watched time for the month
            cursor.execute(f"SELECT SUM(watched_time) FROM {daily_table_name}")
            sum_watched = cursor.fetchone()[0]
            if sum_watched:
                total_watched_time_seconds += sum_watched

            # Aggregate watch times by channel
            # Aggregate watch times by channel
            cursor.execute(f"SELECT channel_name, COUNT(video_id) FROM {daily_table_name} GROUP BY channel_name")
            channel_data = cursor.fetchall()
            for channel, video_count_channel in channel_data:
                if channel:
                    channel_watch_times[channel] = channel_watch_times.get(channel, 0) + video_count_channel
            
            # Aggregate watch times by date
            date_part_dd_mm_yyyy = current_date.strftime('%d_%m_%Y')
            cursor.execute(f"SELECT SUM(watched_time) FROM {daily_table_name}")
            sum_watched_date = cursor.fetchone()[0]
            if sum_watched_date:
                date_watch_times[date_part_dd_mm_yyyy] = date_watch_times.get(date_part_dd_mm_yyyy, 0) + sum_watched_date
        
        current_date += datetime.timedelta(days=1)

    total_hours_watched = total_watched_time_seconds / 3600.0

    most_watched_channel = "N/A"
    top_channels = []
    if channel_watch_times:
        most_watched_channel = max(channel_watch_times, key=channel_watch_times.get)
        # Get top 10 channels sorted by video count
        top_channels = sorted(channel_watch_times.items(), key=lambda x: x[1], reverse=True)[:10]

    # Convert top_channels to a JSON-serializable format
    top_channels_list = [{"channel": channel, "count": count} for channel, count in top_channels]

    most_watched_date = "N/A"
    most_watched_date_time = 0
    if date_watch_times:
        most_watched_date_raw = max(date_watch_times, key=date_watch_times.get)
        most_watched_date = most_watched_date_raw # Already in DD_MM_YYYY format
        most_watched_date_time = date_watch_times[most_watched_date_raw]

    cursor.execute(f"SELECT * FROM {monthly_table_name}")
    existing_summary = cursor.fetchone()

    import json
    top_channels_json = json.dumps(top_channels_list)

    # Check if top_channels column exists
    cursor.execute(f"PRAGMA table_info({monthly_table_name})")
    columns = cursor.fetchall()
    has_top_channels = any(col['name'] == 'top_channels' for col in columns)

    if existing_summary:
        if has_top_channels:
            cursor.execute(f"""
                UPDATE {monthly_table_name}
                SET total_hours_watched = ?,
                    most_watched_channel = ?,
                    most_watched_date = ?,
                    most_watched_date_time = ?,
                    top_channels = ?
                WHERE id = ?
            """, (total_hours_watched, most_watched_channel, most_watched_date, most_watched_date_time, top_channels_json, existing_summary['id']))
        else:
            cursor.execute(f"""
                UPDATE {monthly_table_name}
                SET total_hours_watched = ?,
                    most_watched_channel = ?,
                    most_watched_date = ?,
                    most_watched_date_time = ?
                WHERE id = ?
            """, (total_hours_watched, most_watched_channel, most_watched_date, most_watched_date_time, existing_summary['id']))
    else:
        if has_top_channels:
            cursor.execute(f"""
                INSERT INTO {monthly_table_name}
                (total_hours_watched, most_watched_channel, most_watched_date, most_watched_date_time, top_channels)
                VALUES (?, ?, ?, ?, ?)
            """, (total_hours_watched, most_watched_channel, most_watched_date, most_watched_date_time, top_channels_json))
        else:
            cursor.execute(f"""
                INSERT INTO {monthly_table_name}
                (total_hours_watched, most_watched_channel, most_watched_date, most_watched_date_time)
                VALUES (?, ?, ?, ?)
            """, (total_hours_watched, most_watched_channel, most_watched_date, most_watched_date_time))

    conn.commit()
    conn.close()

def get_daily_watch_history(date_obj):
    table_name = date_obj.strftime("daily_%d_%m_%Y")
    conn = get_db_connection()
    cursor = conn.cursor()
    print(f"[DEBUG] get_daily_watch_history for table: {table_name}")
    try:
        cursor.execute(f"SELECT * FROM {table_name} ORDER BY timestamp DESC")
        history = cursor.fetchall()
        print(f"[DEBUG] Retrieved {len(history)} records from {table_name}")
        return [dict(row) for row in history]
    except sqlite3.OperationalError:
        print(f"[DEBUG] Table {table_name} does not exist.")
        return [] # Table might not exist yet
    finally:
        conn.close()

def get_monthly_summary(year, month):
    month_year_str = f"{month:02d}_{year}"
    table_name = f"monthly_{month_year_str}"
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(f"SELECT * FROM {table_name}")
        summary = cursor.fetchone()
        if summary:
            summary_dict = dict(summary)
            # Parse top_channels JSON if it exists and has data
            if 'top_channels' in summary_dict and summary_dict['top_channels']:
                import json
                try:
                    summary_dict['top_channels'] = json.loads(summary_dict['top_channels'])
                except:
                    summary_dict['top_channels'] = []
            else:
                summary_dict['top_channels'] = []
            return summary_dict
        return None
    except sqlite3.OperationalError:
        return None
    finally:
        conn.close()

def get_daily_summary(date_obj):
    table_name = date_obj.strftime("daily_%d_%m_%Y")
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Get total watched time for the day
        cursor.execute(f"SELECT SUM(watched_time) FROM {table_name}")
        total_seconds = cursor.fetchone()[0] or 0
        total_hours = total_seconds / 3600.0

        # Get top channels for the day
        cursor.execute(f"SELECT channel_name, COUNT(*) as video_count FROM {table_name} WHERE channel_name IS NOT NULL AND channel_name != '' GROUP BY channel_name ORDER BY video_count DESC LIMIT 10")
        top_channels = cursor.fetchall()
        top_channels_list = [{"channel": row['channel_name'], "count": row['video_count']} for row in top_channels]

        return {
            'total_hours_watched': total_hours,
            'top_channels': top_channels_list
        }
    except sqlite3.OperationalError:
        return {'total_hours_watched': 0, 'top_channels': []}
    finally:
        conn.close()

def create_watch_later_table():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS watch_later_videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            video_id TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            link TEXT NOT NULL,
            category TEXT,
            comment TEXT,
            thumbnail_path TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def add_watch_later_video(video_id, title, link, category=None, comment=None, thumbnail_path=None):
    create_watch_later_table()
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO watch_later_videos
            (video_id, title, link, category, comment, thumbnail_path)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (video_id, title, link, category, comment, thumbnail_path))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        print(f"Video with ID {video_id} already exists in watch later.")
        return False
    finally:
        conn.close()

def get_watch_later_videos(category=None):
    create_watch_later_table()
    conn = get_db_connection()
    cursor = conn.cursor()
    if category:
        cursor.execute("SELECT * FROM watch_later_videos WHERE category = ? ORDER BY timestamp DESC", (category,))
    else:
        cursor.execute("SELECT * FROM watch_later_videos ORDER BY timestamp DESC")
    videos = cursor.fetchall()
    conn.close()
    return [dict(row) for row in videos]

def remove_watch_later_video(video_id):
    create_watch_later_table()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM watch_later_videos WHERE video_id = ?", (video_id,))
    conn.commit()
    conn.close()

def get_watch_later_categories():
    create_watch_later_table()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT category FROM watch_later_videos WHERE category IS NOT NULL AND category != '' ORDER BY category")
    categories = cursor.fetchall()
    conn.close()
    return [row['category'] for row in categories]

