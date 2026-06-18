-- Supabase schema for VCM analysis platform
-- Run in Supabase SQL editor or psql: \i sql/schema.sql

set search_path to public;

-- Drop existing artifacts (optional for dev refresh)
drop view if exists v_project_explorer cascade;
drop view if exists v_dashboard_overview cascade;
drop materialized view if exists vcm_project_metrics cascade;
drop table if exists vcm_ai_memos;
drop table if exists vcm_project_yearly;
drop table if exists vcm_projects cascade;

-- Canonical projects table sourced from Berkeley PROJECTS sheet
create table vcm_projects (
    project_id text primary key,
    project_name text not null,
    registry text not null,
    status text,
    scope text,
    project_type text,
    reduction_removal text,
    methodology text,
    methodology_version text,
    region text,
    country text,
    state text,
    developer text,
    operator text,
    verifier text,
    registry_documents text,
    issued_total numeric not null default 0,
    retired_total numeric not null default 0,
    remaining_total numeric not null default 0,
    buffer_deposits_total numeric,
    source text not null default 'berkeley_vro',
    as_of_date date not null
);

-- Yearly project metrics sourced from Berkeley sheet year columns
create table vcm_project_yearly (
    project_id text not null references vcm_projects(project_id) on delete cascade,
    year int not null,
    issued_vintage numeric not null default 0,
    retired_total numeric not null default 0,
    remaining_vintage numeric not null default 0,
    issued_issuance numeric not null default 0,
    primary key (project_id, year)
);

create index idx_vcm_project_yearly_year on vcm_project_yearly (year);
create index idx_vcm_project_yearly_project on vcm_project_yearly (project_id);

create index idx_vcm_projects_registry on vcm_projects (registry);
create index idx_vcm_projects_project_type on vcm_projects (project_type);
create index idx_vcm_projects_country on vcm_projects (country);
create index idx_vcm_projects_status on vcm_projects (status);
create index idx_vcm_projects_verifier on vcm_projects (verifier);
create index idx_vcm_projects_registry_project_type on vcm_projects (registry, project_type);
create index idx_vcm_projects_issued_total on vcm_projects (issued_total);
create index idx_vcm_projects_retired_total on vcm_projects (retired_total);

-- Peer benchmark helper CTE packaged inside materialized view
create materialized view vcm_project_metrics as
with cleaned as (
    select
        project_id,
        issued_total,
        retired_total,
        remaining_total,
        registry,
        project_type,
        greatest(remaining_total, 0) as overhang,
        case
            when issued_total <= 0 then 0
            else retired_total / nullif(issued_total, 0)
        end as uptake_ratio
    from vcm_projects
),
peer_counts as (
    select registry, project_type, count(*) as registry_type_cnt
    from cleaned
    group by registry, project_type
),
project_type_counts as (
    select project_type, count(*) as type_cnt
    from cleaned
    group by project_type
),
with_peer_group as (
    select
        c.*,
        case
            when coalesce(pc.registry_type_cnt, 0) >= 30 then concat_ws('|', c.registry, c.project_type)
            else c.project_type
        end as peer_group
    from cleaned c
    left join peer_counts pc on pc.registry = c.registry and pc.project_type = c.project_type
    left join project_type_counts ptc on ptc.project_type = c.project_type
),
peer_percentiles as (
    select
        project_id,
        peer_group,
        uptake_ratio,
        percent_rank() over (partition by peer_group order by uptake_ratio) * 100 as peer_uptake_percentile
    from with_peer_group
),
peer_medians as (
    select
        peer_group,
        percentile_cont(0.5) within group (order by uptake_ratio) as peer_uptake_median
    from with_peer_group
    group by peer_group
)
select
    w.project_id,
    w.uptake_ratio,
    case
        when w.uptake_ratio < 0.10 then 'Low'
        when w.uptake_ratio <= 0.50 then 'Medium'
        else 'High'
    end as uptake_band,
    w.overhang,
    case
        when w.issued_total <= 0 then '0'
        when w.issued_total < 10000 then '1-10k'
        when w.issued_total < 100000 then '10k-100k'
        else '100k+'
    end as issued_bucket,
    w.peer_group,
    ps.peer_uptake_percentile,
    pm.peer_uptake_median,
    jsonb_build_object(
        'low_uptake', (w.uptake_ratio < 0.10),
        'high_overhang', (w.overhang > 0 and w.overhang > w.project_retired_total),
        'zero_retired_after_issuance', (w.issued_total > 0 and w.retired_total = 0),
        'inactive_or_terminated', (w.status ilike any (array['inactive', 'terminated', 'expired']))
    ) as flags
from (
    select
        w.*,
        vp.retired_total as project_retired_total,
        vp.status
    from with_peer_group w
    join vcm_projects vp on vp.project_id = w.project_id
) w
join peer_percentiles ps on ps.project_id = w.project_id
left join peer_medians pm on pm.peer_group = w.peer_group;

create unique index idx_vcm_project_metrics_project_id on vcm_project_metrics (project_id);

-- Explorer view combines canonical records + metrics for frontend querying
create view v_project_explorer as
select
    p.*,
    m.uptake_ratio,
    m.uptake_band,
    m.overhang,
    m.issued_bucket,
    m.peer_group,
    m.peer_uptake_percentile,
    m.peer_uptake_median,
    m.flags
from vcm_projects p
left join vcm_project_metrics m on m.project_id = p.project_id;

-- Dashboard overview view returns aggregates and sliced breakdowns
create view v_dashboard_overview as
with totals as (
    select
        sum(issued_total) as total_issued,
        sum(retired_total) as total_retired,
        sum(remaining_total) as total_remaining,
        case
            when sum(issued_total) = 0 then 0
            else sum(retired_total) / nullif(sum(issued_total), 0)
        end as overall_uptake_ratio
    from vcm_projects
),
registry_breakdown as (
    select jsonb_agg(jsonb_build_object(
        'registry', registry,
        'issued_total', issued_total
    ) order by issued_total desc) as data
    from (
        select registry, sum(issued_total) as issued_total
        from vcm_projects
        group by registry
    ) s
),
type_breakdown as (
    select jsonb_agg(jsonb_build_object(
        'project_type', project_type,
        'issued_total', issued_total
    ) order by issued_total desc) as data
    from (
        select project_type, sum(issued_total) as issued_total
        from vcm_projects
        group by project_type
    ) s
),
reduction_vs_removal as (
    select jsonb_agg(jsonb_build_object(
        'reduction_removal', reduction_removal,
        'issued_total', issued_total
    )) as data
    from (
        select coalesce(reduction_removal, 'unknown') as reduction_removal,
        sum(issued_total) as issued_total
        from vcm_projects
        group by 1
    ) s
),
uptake_histogram as (
    select jsonb_agg(jsonb_build_object(
        'bucket', bucket,
        'project_count', project_count
    ) order by bucket) as data
    from (
        select
            case
                when uptake_ratio < 0 then '<0'
                when uptake_ratio < 0.1 then '0-10%'
                when uptake_ratio < 0.25 then '10-25%'
                when uptake_ratio < 0.5 then '25-50%'
                when uptake_ratio < 0.75 then '50-75%'
                when uptake_ratio <= 1 then '75-100%'
                else '100%+'
            end as bucket,
            count(*) as project_count
        from vcm_project_metrics
        group by 1
    ) s
),
uptake_band_by_registry as (
    select jsonb_agg(jsonb_build_object(
        'registry', registry,
        'band_counts', band_counts
    ) order by registry) as data
    from (
        select
            registry,
            jsonb_object_agg(uptake_band, band_count order by uptake_band) as band_counts
        from (
            select
                p.registry,
                m.uptake_band,
                count(*) as band_count
            from v_project_explorer p
            join vcm_project_metrics m on m.project_id = p.project_id
            group by p.registry, m.uptake_band
        ) s
        group by registry
    ) agg
)
select
    totals.total_issued,
    totals.total_retired,
    totals.total_remaining,
    totals.overall_uptake_ratio,
    registry_breakdown.data as issued_by_registry,
    type_breakdown.data as issued_by_project_type,
    reduction_vs_removal.data as reduction_vs_removal,
    uptake_histogram.data as uptake_histogram,
    uptake_band_by_registry.data as uptake_band_by_registry
from totals, registry_breakdown, type_breakdown, reduction_vs_removal, uptake_histogram, uptake_band_by_registry;

-- AI memo caching table
create table vcm_ai_memos (
    project_id text primary key references vcm_projects(project_id) on delete cascade,
    memo_json jsonb not null,
    model text not null,
    created_at timestamptz not null default now()
);

-- Helper refresh function for metrics materialized view
create or replace function refresh_vcm_metrics()
returns void
language plpgsql
as $$
begin
    refresh materialized view concurrently vcm_project_metrics;
end;
$$;
