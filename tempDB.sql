BEGIN;
-- STRONG ENTITIES
create table Users(
    id int GENERATED ALWAYS AS IDENTITY primary key,--generated always as IDENTITY,
    email varchar(50) not NULL,
    fname VARCHAR(50) not null,
    lname VARCHAR(50) not null,
    bio   TEXT,
    img_url varchar(200),
    user_password varchar(20) not null
);
create table Students(
    id int,
    PRIMARY key(id),
    FOREIGN key (id) references Users(id)
	on update cascade 
	on delete cascade
);
create table Admins(
    id int,
    PRIMARY key(id),
    FOREIGN key (id) references Users(id)
	on update cascade 
	on delete cascade
);
create table Teams(
    id int GENERATED ALWAYS AS IDENTITY primary key,--generated always as IDENTITY,
    name VARCHAR(50) not null,
    description   TEXT,
	leader_id int ,
	responded_by int ,
	acceptance_status text ,
	
	foreign key(responded_by) references Admins
	on update cascade
	on delete set null,

	foreign key (leader_id) references students
	on update cascade 
	on delete set null 
);
CREATE table Rooms(
    id int GENERATED ALWAYS AS IDENTITY primary key,--generated always as IDENTITY PRIMARY Key,
    name VARCHAR(50) not null,
    capacity int not null,
    location TEXT
);
create table Speakers(
    id int GENERATED ALWAYS AS IDENTITY primary key,--generated always as IDENTITY PRIMARY Key,
    name varchar(50) not null,
    bio TEXT,
    fname VARCHAR(50),
    lname VARCHAR(50),
    contact int,
    email varchar(50) not NULL
);
create table Events(
    id int GENERATED ALWAYS AS IDENTITY primary key,--generated always as IDENTITY PRIMARY Key,
    title varchar(50) not null,
    discription text,
    type varchar(50),
    issued_at TIMESTAMP with time zone DEFAULT now(),
    start_time TIMESTAMP with time zone DEFAULT now(),
    end_time TIMESTAMP with time zone DEFAULT now(),
	team_id int ,
	responded_by int ,
	acceptance_status text ,
	foreign key(responded_by) references Admins
	on update cascade
	on delete set null,
	foreign key(team_id) references Teams
	on update cascade
	on delete cascade
);
create table Posts(
    id int GENERATED ALWAYS AS IDENTITY primary key,--generated always as identity primary key,
    description text,
    issued_at TIMESTAMP with time zone DEFAULT now()
);
create table Rides(
    id int GENERATED ALWAYS AS IDENTITY primary key,--generated always as identity primary key,
    to_loc text,
    from_loc text,
    price int,
    seats_available int,
    arrival_time TIMESTAMP with time zone DEFAULT now(),
    service varchar(50),
	created_by int not null,
	foreign key(created_by) references Students
	on update cascade
	on delete cascade
);
----=============================
--WEAKENTITIES

create table PostMedia(
    id int not null,
    description text,
    url text,
    type VARCHAR(50),
    post_id int,
	primary key (post_id , id),
    foreign key(post_id) REFERENCES Posts
	on update cascade 
	on delete cascade
);

create table Comments(
    id int not null GENERATED ALWAYS AS IDENTITY primary key,
	author int ,
    content text,
    post_id int not null,
    issued_at TIMESTAMP with time zone DEFAULT now() ,
	parent_id int,
    foreign key(post_id) REFERENCES Posts
	on update cascade 
	on delete cascade ,
	foreign key(author) references Users
	on update cascade 
	on delete set null,
	foreign key(parent_id) references Comments
	on update cascade
	on delete cascade
);

--===========================================
-- 1:1 RELATIONSHIPS
-- LEAD IS A 1:1 RELATION SHIP NUT THE TEAM IS TOTAL PARTIIPACTE SO IT PUT IN TEAM TABLE
--==============================
-- 1:N RELATION SHIPS
--1- author --> between comment and user (put in comment table as comment is total participation)
--2-ACCEPT--> between ADMIN AND EVENT put in Event as event is total participation
--3- ORGANIZE--> between ADMIN AND EVENT put in Event as event is total participation
--4- create ride--> between student AND RIDE put in RIDE as RIDE is total participation
--5-
create table Take_Place(
	event_id int primary key,
	room_id int not null,
	foreign key(event_id) references Events
	on update cascade 
	on delete cascade,

	foreign key(room_id) references Rooms
	on update cascade 
	on delete cascade --change the room 
);

--====================================
--N:M RELATIONSHIPS
create table Messages(
msg_id int primary key,
send_at TIMESTAMP with time zone DEFAULT now() ,
content text,
sender_id int ,
reciever_id int,

foreign key (sender_id) references Users
on update cascade 
on delete cascade ,
foreign key (reciever_id ) references Users
on update cascade 
on delete cascade
);

create table Speak(
	speaker_id int ,
	event_id int ,
	primary key (speaker_id,event_id),
	
	foreign key(event_id) references Events
	on update cascade
	on delete cascade,

	foreign key(speaker_id) references Speakers
	on update cascade
	on delete cascade
);

create table Reports(
	student_id int ,
	post_id int ,
	describtion text not null,
	primary key(student_id,post_id) ,

	foreign key (post_id) references Posts
	on update cascade
	on delete cascade ,

	foreign key (student_id) references Students
	on update cascade
	on delete cascade
);

create table Subscibe(
	user_id int,
	team_id int ,
	primary key(user_id,team_id),

	foreign key(team_id) references Teams
	on update cascade
	on delete cascade,

	foreign key(user_id) references Users
	on update cascade
	on delete cascade
);

create table Join_ride(
	student_id int,
	ride_id int ,
	primary key(ride_id,student_id),

	foreign key(student_id) references Students
	on update cascade
	on delete cascade,

	foreign key(ride_id) references Rides
	on update cascade
	on delete cascade
);

create table Belong_To(
	student_id int,
	team_id int ,
	role text not null,
	primary key(team_id,student_id),

	foreign key(student_id) references Students
	on update cascade
	on delete cascade,

	foreign key(team_id) references Teams
	on update cascade
	on delete cascade
);

create table Apply(
	student_id int,
	team_id int ,
	cv_url text not null,
	role text not null,

	primary key(team_id,student_id),

	foreign key(student_id) references Students
	on update cascade
	on delete cascade,

	foreign key(team_id) references Teams
	on update cascade
	on delete cascade
);

create table Badges(
	student_id int,
	team_id int ,
	type_ text not null,
	pionts int default 0,
	exp_date TIMESTAMP with time zone DEFAULT now(),
	usage_num int ,
	primary key(team_id,student_id),

	foreign key(student_id) references Students
	on update cascade
	on delete cascade,

	foreign key(team_id) references Teams
	on update cascade
	on delete cascade
);

create table  Tickets_And_Feedback(
 event_id int ,
 student_id int ,
 Certification_URL text ,
 date_issued TIMESTAMP with time zone DEFAULT now() ,
 price int not null ,
 scanned int , --boolean in postgre
 rating int check (rating >=0 and rating<=5),
 feedback text ,

 primary key(event_id,student_id),

 foreign key (event_id) references Events
 	on update cascade
	on delete cascade,

 foreign key (student_id) references Students
 	on update cascade
	on delete cascade
);

--=============================
--TERNARY
create table Create_Post(
 post_id int primary key,
 team_id int not null,
 user_id int not null,

 foreign key(post_id) references Posts
 on update cascade
 on delete cascade,

  foreign key(team_id) references Teams
 on update cascade
 on delete cascade,
 
  foreign key(user_id) references Users
 on update cascade
 on delete cascade

);

COMMIT ;