create table User (
    id int generated always as IDENTITY,
    email varchar(50) not NULL,
    fname VARCHAR(50) not null,
    lname VARCHAR(50) not null,
    bio   TEXT,
    img_url varchar(200),
    user_password varchar(20) not null,
    primary key(id)
);


create table Student(
    id int,
    PRIMARY key(id),
    FOREIGN key (id) references User(id)
);

create table Admin(
    id int,
    PRIMARY key(id),
    FOREIGN key (id) references User(id)
);

create table Team(
    id int generated always as IDENTITY,
    name VARCHAR(50) not null,
    description   TEXT,

    PRIMARY key (id),
);

CREATE table Room(
    id int generated always as IDENTITY PRIMARY Key,
    name VARCHAR(50) not null,
    capacity int not null,
    location TEXT
);

create table Speaker(
    id int generated always as IDENTITY PRIMARY Key,
    name varchar(50) not null,
    bio TEXT,
    fname VARCHAR(50),
    lname VARCHAR(50),
    contact int,
    email varchar(50) not NULL
);

create table event(
    id int generated always as IDENTITY PRIMARY Key,
    title varchar(50) not null,
    discription text,
    type varchar(50),
    issued_at TIMESTAMP,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    primary key id
);

create table Post(
    id int generated always as identity primary key,
    description text,
    issued_at TIMESTAMP,
);
create table PostMedia(
    id int not null,
    description text,
    url text,
    type VARCHAR(50)
    post_id int,
    post_id foreign key REFERENCES Post,
    primary key (post_id , id)
);
create table Comment(
id int not null,
    content text,
    post_id int,
    issued_at TIMESTAMP,
    post_id foreign key REFERENCES Post,
    primary key (post_id , id)
);

create table Ride (
    id int generated always as identity primary key,
    to_loc text,
    from_loc text,
    price int,
    seats_available int,
    arrival_time TIMESTAMP,
    service varchar(50),
)