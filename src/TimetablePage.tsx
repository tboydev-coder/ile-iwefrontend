import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, MapPin } from 'lucide-react';
import { api } from './api';
import type { Page, Row } from './api';
import { PageHeader, Loading, ErrorState, Empty, Badge } from './components';
import { Records, ResourceSelect, Cell } from './Records';

export function TimetablePage() {
  const [tab, setTab] = useState('week'),
    [classId, setClassId] = useState(''),
    [teacherId, setTeacherId] = useState(''),
    [room, setRoom] = useState('');
  const query = useQuery({
    queryKey: ['timetable-week', classId, teacherId, room],
    queryFn: async () => {
      const filters = new URLSearchParams();
      if (classId) filters.set('class_id', classId);
      if (teacherId) filters.set('teacher_id', teacherId);
      if (room) filters.set('room', room);
      const records: Row[] = [];
      for (let page = 1; ; page++) {
        const data = await api<Page>(`/records/timetable?${filters}&page_size=100&page=${page}`);
        records.push(...data.items);
        if (records.length >= data.total)
          return records.sort((a, b) => a.start_time.localeCompare(b.start_time));
      }
    },
  });
  return (
    <>
      <PageHeader
        eyebrow="A LITTLE STRUCTURE. A LOT OF POSSIBILITY."
        title="Timetable"
        description="A clear week for every class, teacher, and room."
      />
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'week'} onClick={() => setTab('week')}>
          Weekly schedule
        </button>
        <button role="tab" aria-selected={tab === 'entries'} onClick={() => setTab('entries')}>
          Manage entries
        </button>
      </div>
      {tab === 'entries' ? (
        <Records resource="timetable" embedded />
      ) : (
        <>
          <div className="panel attendance-filters">
            <ResourceSelect
              resource="classes"
              title="Filter by class"
              value={classId}
              onChange={setClassId}
            />
            <ResourceSelect
              resource="users"
              title="Filter by teacher"
              value={teacherId}
              onChange={setTeacherId}
              teacherOnly
            />
            <label className="field">
              <span>Filter by room</span>
              <input
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="Exact room name"
              />
            </label>
          </div>
          {query.isPending ? (
            <Loading />
          ) : query.error ? (
            <ErrorState error={query.error} retry={() => void query.refetch()} />
          ) : !query.data.length ? (
            <section className="panel">
              <Empty
                title="A clear week ahead"
                description="Create entries in Manage entries, or adjust your class, teacher, and room filters."
              />
            </section>
          ) : (
            <div className="week-scroll">
              <div className="week-grid">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(
                  (day, index) => (
                    <section className="week-day" key={day}>
                      <h2>
                        <CalendarDays size={14} />
                        {day}
                      </h2>
                      {query.data
                        .filter((r) => r.weekday === index)
                        .map((row) => (
                          <article className="lesson-card" key={row.id}>
                            <time>
                              {row.start_time.slice(0, 5)} – {row.end_time.slice(0, 5)}
                            </time>
                            <strong>
                              <Cell field="subject_id" value={row.subject_id} />
                            </strong>
                            <span>
                              <Cell field="class_id" value={row.class_id} />
                            </span>
                            <small>
                              <Cell field="teacher_id" value={row.teacher_id} />
                            </small>
                            <small className="lesson-room">
                              <MapPin size={11} />
                              {row.room}
                            </small>
                            <Badge value={row.published ? 'PUBLISHED' : 'DRAFT'} />
                          </article>
                        ))}
                      {!query.data.some((r) => r.weekday === index) && (
                        <p className="free-day">No lessons</p>
                      )}
                    </section>
                  ),
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
