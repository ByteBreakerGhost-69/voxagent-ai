import { pool } from "../db/client";

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  durationMinutes: number;
}

export async function bookEvent(
  title: string,
  date: string,
  time: string,
  durationMinutes = 60
) {
  const result = await pool.query(
    `
      INSERT INTO calendar_events
        (title, event_date, event_time, duration_minutes)
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        title,
        event_date,
        event_time,
        duration_minutes,
        created_at
    `,
    [title, date, time, durationMinutes]
  );

  const event = result.rows[0];

  return {
    success: true,
    message: `Event "${event.title}" booked successfully.`,
    event
  };
}

export async function getEvents() {
  const result = await pool.query(
    `
      SELECT
        id,
        title,
        event_date,
        event_time,
        duration_minutes,
        created_at
      FROM calendar_events
      ORDER BY event_date ASC, event_time ASC
    `
  );

  return {
    success: true,
    count: result.rows.length,
    events: result.rows.map((event) => ({
      id: event.id,
      title: event.title,
      date: String(event.event_date),
      time: String(event.event_time).slice(0, 5),
      durationMinutes: Number(event.duration_minutes)
    }))
  };
}
