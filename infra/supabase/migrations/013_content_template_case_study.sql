-- Allow case_study artifact type for Content Studio templates and projects

ALTER TABLE content_templates
  DROP CONSTRAINT IF EXISTS content_templates_artifact_type_check;

ALTER TABLE content_templates
  ADD CONSTRAINT content_templates_artifact_type_check
  CHECK (artifact_type IN ('deck', 'one_pager', 'image', 'case_study'));

ALTER TABLE content_studio_projects
  DROP CONSTRAINT IF EXISTS content_studio_projects_artifact_type_check;

ALTER TABLE content_studio_projects
  ADD CONSTRAINT content_studio_projects_artifact_type_check
  CHECK (artifact_type IN ('deck', 'one_pager', 'image', 'case_study'));
