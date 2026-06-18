-- Core metrics schema for offline AI insights (Berkeley-driven)
set search_path to public;

create table if not exists dim_project (
    canonical_project_id text primary key,
    registry text not null,
    registry_project_id text,
    project_name text not null,
    country text,
    project_type text,
    methodology text,
    source_priority text not null
);

create table if not exists project_id_map (
    canonical_project_id text not null references dim_project(canonical_project_id) on delete cascade,
    source text not null,
    source_project_id text not null,
    registry text,
    registry_project_id text,
    unique (source, source_project_id)
);

create index if not exists idx_project_id_map_canonical on project_id_map (canonical_project_id);

create table if not exists fct_credit_events (
    canonical_project_id text not null references dim_project(canonical_project_id) on delete cascade,
    registry text not null,
    event_type text not null,
    vintage_year int,
    event_date date,
    event_year int not null,
    quantity_t numeric not null,
    source text not null,
    ingested_at timestamptz not null default now(),
    check (quantity_t >= 0)
);

create index if not exists idx_fct_credit_events_project on fct_credit_events (canonical_project_id);
create index if not exists idx_fct_credit_events_registry_year on fct_credit_events (registry, event_year);
create index if not exists idx_fct_credit_events_type_year on fct_credit_events (event_type, event_year);

-- Project-year metrics derived from fct_credit_events
create or replace view project_year_metrics as
with yearly as (
    select
        canonical_project_id,
        registry,
        event_year as year,
        sum(case when event_type = 'issuance' then quantity_t else 0 end) as issued_t,
        sum(case when event_type = 'retirement' then quantity_t else 0 end) as retired_t,
        count(*) as n_events
    from fct_credit_events
    group by 1, 2, 3
)
select
    canonical_project_id,
    registry,
    year,
    issued_t,
    retired_t,
    case
        when issued_t = 0 then null
        else retired_t / nullif(issued_t, 0)
    end as retirement_ratio,
    issued_t - retired_t as net_balance_t,
    case
        when lag(issued_t) over w is null or lag(issued_t) over w = 0 then null
        else (issued_t - lag(issued_t) over w) / nullif(lag(issued_t) over w, 0)
    end as issued_yoy_pct,
    case
        when lag(retired_t) over w is null or lag(retired_t) over w = 0 then null
        else (retired_t - lag(retired_t) over w) / nullif(lag(retired_t) over w, 0)
    end as retired_yoy_pct,
    case
        when lag(case when issued_t = 0 then null else retired_t / nullif(issued_t, 0) end) over w is null then null
        else (case when issued_t = 0 then null else retired_t / nullif(issued_t, 0) end)
          - lag(case when issued_t = 0 then null else retired_t / nullif(issued_t, 0) end) over w
    end as ratio_yoy_delta,
    n_events
from yearly
window w as (partition by canonical_project_id, registry order by year);

-- Registry-year benchmarks derived from project_year_metrics
create or replace view registry_year_benchmarks as
select
    registry,
    year,
    percentile_cont(0.5) within group (order by retirement_ratio) as median_retirement_ratio,
    percentile_cont(0.25) within group (order by retirement_ratio) as p25_retirement_ratio,
    percentile_cont(0.75) within group (order by retirement_ratio) as p75_retirement_ratio,
    percentile_cont(0.5) within group (order by issued_yoy_pct) as median_issued_yoy_pct,
    percentile_cont(0.5) within group (order by retired_yoy_pct) as median_retired_yoy_pct
from project_year_metrics
where issued_t > 0 or retired_t > 0
group by registry, year;

-- Per project-year percentiles within registry/year
create or replace view project_year_percentiles as
select
    canonical_project_id,
    registry,
    year,
    percent_rank() over (partition by registry, year order by retirement_ratio) * 100 as retirement_ratio_pctile,
    percent_rank() over (partition by registry, year order by issued_yoy_pct) * 100 as issued_yoy_pctile,
    percent_rank() over (partition by registry, year order by retired_yoy_pct) * 100 as retired_yoy_pctile
from project_year_metrics;

-- Optional seed statements (run after creating tables)
-- Insert Berkeley projects into dim_project + project_id_map
-- insert into dim_project (canonical_project_id, registry, registry_project_id, project_name, country, project_type, methodology, source_priority)
-- select project_id, registry, project_id, project_name, country, project_type, methodology, 'berkeley'
-- from vcm_projects
-- on conflict (canonical_project_id) do nothing;
--
-- insert into project_id_map (canonical_project_id, source, source_project_id, registry, registry_project_id)
-- select project_id, 'berkeley', project_id, registry, project_id
-- from vcm_projects
-- on conflict (source, source_project_id) do nothing;
--
-- Insert Berkeley yearly issuance/retirements into fct_credit_events
-- insert into fct_credit_events (canonical_project_id, registry, event_type, event_year, quantity_t, source)
-- select p.project_id, p.registry, 'issuance', y.year, y.issued_issuance, 'berkeley'
-- from vcm_project_yearly y
-- join vcm_projects p on p.project_id = y.project_id
-- where y.year >= 0 and y.issued_issuance > 0;
--
-- insert into fct_credit_events (canonical_project_id, registry, event_type, event_year, quantity_t, source)
-- select p.project_id, p.registry, 'retirement', y.year, y.retired_total, 'berkeley'
-- from vcm_project_yearly y
-- join vcm_projects p on p.project_id = y.project_id
-- where y.year >= 0 and y.retired_total > 0;
