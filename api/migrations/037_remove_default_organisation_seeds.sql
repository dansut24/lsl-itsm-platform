-- Remove onboarding-created placeholder organisation scopes so production RMM/ITSM surfaces show only real data.
-- Account-backed People are preserved; their generated default site/team/department links are cleared by FK behavior.

DELETE FROM organisation_team_memberships m
USING organisation_teams t
WHERE m.team_id=t.id AND t.external_key='TEAM-SERVICE-DESK';

DELETE FROM organisation_sites
WHERE external_key='SITE-DEFAULT';

DELETE FROM organisation_teams
WHERE external_key='TEAM-SERVICE-DESK';

DELETE FROM organisation_departments
WHERE external_key='DEPT-DEFAULT';

-- Reserve the retired placeholder keys so they cannot be recreated by stale clients.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='organisation_sites_no_default_seed'
      AND conrelid='organisation_sites'::regclass
  ) THEN
    ALTER TABLE organisation_sites
      ADD CONSTRAINT organisation_sites_no_default_seed
      CHECK (external_key <> 'SITE-DEFAULT');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='organisation_teams_no_default_seed'
      AND conrelid='organisation_teams'::regclass
  ) THEN
    ALTER TABLE organisation_teams
      ADD CONSTRAINT organisation_teams_no_default_seed
      CHECK (external_key <> 'TEAM-SERVICE-DESK');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname='organisation_departments_no_default_seed'
      AND conrelid='organisation_departments'::regclass
  ) THEN
    ALTER TABLE organisation_departments
      ADD CONSTRAINT organisation_departments_no_default_seed
      CHECK (external_key <> 'DEPT-DEFAULT');
  END IF;
END $$;
