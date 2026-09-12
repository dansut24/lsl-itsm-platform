-- First-class task queue support and approval-state assignment guarantees.

UPDATE service_requests
SET assigned_person_id = NULL,
    updated_at = now()
WHERE status = 'Pending Approval'
  AND assigned_person_id IS NOT NULL;

CREATE OR REPLACE FUNCTION hi5_service_request_pending_approval_unassigned()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'Pending Approval' THEN
    NEW.assigned_person_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS service_request_pending_approval_unassigned ON service_requests;
CREATE TRIGGER service_request_pending_approval_unassigned
BEFORE INSERT OR UPDATE OF status, assigned_person_id
ON service_requests
FOR EACH ROW
EXECUTE FUNCTION hi5_service_request_pending_approval_unassigned();

CREATE INDEX IF NOT EXISTS service_request_tasks_active_queue_idx
  ON service_request_tasks(tenant_id, status, updated_at DESC)
  WHERE status <> 'Waiting';

CREATE OR REPLACE FUNCTION hi5_service_request_task_completion_activity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  matching_activity uuid;
  actor_name text := 'Hi5Central';
  completion_body text;
BEGIN
  IF NEW.status <> 'Completed' OR OLD.status = 'Completed' THEN
    RETURN NEW;
  END IF;

  SELECT a.id, COALESCE(NULLIF(a.actor_snapshot->>'name', ''), 'Hi5Central')
    INTO matching_activity, actor_name
  FROM service_request_activities a
  WHERE a.tenant_id = NEW.tenant_id
    AND a.request_id = NEW.request_id
    AND a.metadata->>'event' = 'request.task.updated'
    AND a.metadata->>'taskKey' = NEW.external_key
    AND a.created_at >= transaction_timestamp()
  ORDER BY a.created_at DESC
  LIMIT 1;

  completion_body := 'Task ' || NEW.external_key || ' "' || NEW.title || '" completed by ' || actor_name;
  IF NULLIF(btrim(NEW.completion_notes), '') IS NOT NULL THEN
    completion_body := completion_body || ' — ' || NEW.completion_notes;
  END IF;
  completion_body := completion_body || '.';

  IF matching_activity IS NOT NULL THEN
    UPDATE service_request_activities
    SET kind = 'system',
        visibility = 'internal',
        body_text = completion_body,
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'event', 'request.task.completed',
          'taskKey', NEW.external_key,
          'taskTitle', NEW.title,
          'status', 'Completed'
        )
    WHERE id = matching_activity;
  ELSE
    INSERT INTO service_request_activities (
      tenant_id,
      request_id,
      actor_snapshot,
      kind,
      visibility,
      body_text,
      metadata
    ) VALUES (
      NEW.tenant_id,
      NEW.request_id,
      jsonb_build_object('name', 'Hi5Central'),
      'system',
      'internal',
      completion_body,
      jsonb_build_object(
        'event', 'request.task.completed',
        'taskKey', NEW.external_key,
        'taskTitle', NEW.title,
        'status', 'Completed'
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS service_request_task_completion_activity ON service_request_tasks;
CREATE CONSTRAINT TRIGGER service_request_task_completion_activity
AFTER UPDATE ON service_request_tasks
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION hi5_service_request_task_completion_activity();
