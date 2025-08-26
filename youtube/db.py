import sqlite3
import datetime
import os

from youtube import settings

DATABASE_FILE = os.path.join(settings.data_dir, 'youtube_history.db')

def get_db_connection():
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
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def log_video_watch_time(video_id, title, link, watched_time, total_duration, channel_name=None):
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
            (video_id, title, link, watched_time, channel_name, watch_time_percentage)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (video_id, title, link, watched_time, channel_name, watch_time_percentage))
    
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
    if channel_watch_times:
        most_watched_channel = max(channel_watch_times, key=channel_watch_times.get)

    most_watched_date = "N/A"
    most_watched_date_time = 0
    if date_watch_times:
        most_watched_date_raw = max(date_watch_times, key=date_watch_times.get)
        most_watched_date = most_watched_date_raw # Already in DD_MM_YYYY format
        most_watched_date_time = date_watch_times[most_watched_date_raw]

    cursor.execute(f"SELECT * FROM {monthly_table_name}")
    existing_summary = cursor.fetchone()

    if existing_summary:
        cursor.execute(f"""
            UPDATE {monthly_table_name}
            SET total_hours_watched = ?,
                most_watched_channel = ?,
                most_watched_date = ?,
                most_watched_date_time = ?
            WHERE id = ?
        """, (total_hours_watched, most_watched_channel, most_watched_date, most_watched_date_time, existing_summary['id']))
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
        return dict(summary) if summary else None
    except sqlite3.OperationalError:
        return None
    finally:
        conn.close()
