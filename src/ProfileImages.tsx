import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, School } from 'lucide-react';
import { request } from './api';
import type { Row } from './api';
import { useAuth, useToast } from './context';

function usePrivateImage(path: string, enabled: boolean, revision: unknown) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!enabled) return;
    let current = '',
      cancelled = false;
    request(path)
      .then((response) => response.blob())
      .then((blob) => {
        current = URL.createObjectURL(blob);
        if (cancelled) URL.revokeObjectURL(current);
        else setUrl(current);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (current) URL.revokeObjectURL(current);
    };
  }, [path, enabled, revision]);
  return url;
}

export function SchoolLogo() {
  const { session } = useAuth();
  const url = usePrivateImage(
    '/school/logo',
    Boolean(session?.school.has_logo),
    session?.school.updated_at,
  );
  return url ? (
    <img className="school-logo-image" src={url} alt={`${session?.school.name} logo`} />
  ) : (
    <School size={20} />
  );
}

export function StudentPhoto({ student }: { student: Row }) {
  const { can } = useAuth(),
    toast = useToast(),
    client = useQueryClient();
  const [revision, setRevision] = useState(0);
  const url = usePrivateImage(
    `/students/${student.id}/photo`,
    Boolean(student.has_photo || revision),
    revision,
  );
  return (
    <div className="student-photo">
      <span className="large-avatar">
        {url ? (
          <img src={url} alt={student.name} />
        ) : (
          <>
            {student.first_name[0]}
            {student.last_name[0]}
          </>
        )}
      </span>
      {can('students.update') && (
        <label className="photo-upload" title="Upload student photo">
          <Camera size={13} />
          <input
            type="file"
            aria-label="Upload student photo"
            accept="image/jpeg,image/png,image/webp"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const data = new FormData();
              data.append('file', file);
              try {
                await request(`/students/${student.id}/photo`, { method: 'POST', body: data });
                setRevision((n) => n + 1);
                await client.invalidateQueries();
                toast('Student photo updated.');
              } catch (e) {
                toast((e as Error).message, true);
              }
            }}
          />
        </label>
      )}
    </div>
  );
}
