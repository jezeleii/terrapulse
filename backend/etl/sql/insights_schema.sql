-- AI insights schema for offline cached generation
set search_path to public;

create table if not exists project_year_insights (
    canonical_project_id text not null,
    registry text,
    year int not null,
    insight_json jsonb not null,
    model_name text not null,
    prompt_version text,
    metrics_hash text,
    generated_at timestamptz not null default now(),
    primary key (canonical_project_id, year, model_name)
);

create index if not exists idx_project_year_insights_project on project_year_insights (canonical_project_id);
create index if not exists idx_project_year_insights_year on project_year_insights (year);
create index if not exists idx_project_year_insights_registry on project_year_insights (registry);
create index if not exists idx_project_year_insights_generated_at on project_year_insights (generated_at desc);

create table if not exists project_year_insight_runs (
    run_id bigserial primary key,
    canonical_project_id text,
    registry text,
    year int,
    payload_snapshot jsonb,
    raw_model_output text,
    parse_status text,
    duration_ms int,
    created_at timestamptz not null default now()
);
