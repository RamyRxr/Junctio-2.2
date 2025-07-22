-- Database schema for Al-Insan Foundation Sacrifice Management System

-- Drop tables if they exist (in reverse order to avoid foreign key conflicts)
drop table if exists notifications;
drop table if exists media;
drop table if exists agent_donations;
drop table if exists agent_assignments;
drop table if exists cow_shares;
drop table if exists cow_groups;
drop table if exists donations;
drop table if exists donors;

-- Create donors table
create table donors (
    id              serial primary key,
    first_name      varchar(50) not null,
    last_name       varchar(50) not null,
    whatsapp_number varchar(20) not null,
    created_at      timestamp with time zone default current_timestamp
);

-- Create donations table
create table donations (
    id           serial primary key,
    donor_id     integer references donors ( id ) on delete cascade,
    price        decimal(10,2) not null,
    type         varchar(10) not null check ( type in ( 'sheep', 'cow' ) ),
    status       varchar(20) not null default 'pending' check ( status in ( 'pending', 'sending', 'done' ) ),
    created_at   timestamp with time zone default current_timestamp,
    completed_at timestamp with time zone
);

-- Create cow_groups table
create table cow_groups (
    id         serial primary key,
    created_at timestamp with time zone default current_timestamp
);

-- Create cow_shares table
create table cow_shares (
    donation_id  integer unique references donations ( id ) on delete cascade,
    cow_group_id integer references cow_groups ( id ) on delete cascade,
    primary key ( donation_id, cow_group_id )
);

-- Create agent_assignments table
create table agent_assignments (
    id         serial primary key,
    agent_name varchar(100) not null,
    created_at timestamp with time zone default current_timestamp
);

-- Create agent_donations table
create table agent_donations (
    agent_id    integer references agent_assignments ( id ) on delete cascade,
    donation_id integer references donations ( id ) on delete cascade,
    primary key ( agent_id, donation_id )
);

-- Create media table
create table media (
    id          serial primary key,
    donation_id integer references donations ( id ) on delete cascade,
    type        varchar(10) not null check ( type in ( 'image', 'video' ) ),
    file_path   varchar(255) not null,
    created_at  timestamp with time zone default current_timestamp
);

-- Create notifications table
create table notifications (
    id          serial primary key,
    donation_id integer references donations ( id ) on delete cascade,
    message     text not null,
    sent        boolean default false,
    created_at  timestamp with time zone default current_timestamp,
    sent_at     timestamp with time zone
);

-- Create indexes for better performance
create index idx_donations_donor_id on donations ( donor_id );
create index idx_donations_status on donations ( status );
create index idx_cow_shares_cow_group_id on cow_shares ( cow_group_id );
create index idx_agent_donations_agent_id on agent_donations ( agent_id );
create index idx_media_donation_id on media ( donation_id );
