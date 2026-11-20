create table if not exists inbox (id text primary key, text text not null, board text, at integer not null);
create table if not exists boards (k integer primary key, list text not null);
