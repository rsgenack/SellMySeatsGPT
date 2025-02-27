--
-- PostgreSQL database dump
--

-- Dumped from database version 16.8
-- Dumped by pg_dump version 16.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: payments; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.payments (
    id integer NOT NULL,
    user_id integer NOT NULL,
    ticket_id integer NOT NULL,
    amount integer NOT NULL,
    status text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.payments OWNER TO neondb_owner;

--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payments_id_seq OWNER TO neondb_owner;

--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;


--
-- Name: pendingTickets; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public."pendingTickets" (
    id integer NOT NULL,
    user_id integer NOT NULL,
    recipient_email character varying(255) NOT NULL,
    event_name text,
    event_date timestamp without time zone,
    event_time text,
    venue text,
    city text,
    state text,
    section text,
    "row" text,
    seat text,
    email_subject text,
    email_from text,
    raw_email_data text,
    extracted_data jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public."pendingTickets" OWNER TO neondb_owner;

--
-- Name: pendingTickets_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public."pendingTickets_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."pendingTickets_id_seq" OWNER TO neondb_owner;

--
-- Name: pendingTickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public."pendingTickets_id_seq" OWNED BY public."pendingTickets".id;


--
-- Name: pending_tickets; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.pending_tickets (
    id integer NOT NULL,
    user_id integer NOT NULL,
    email_subject text NOT NULL,
    email_from text NOT NULL,
    raw_email_data jsonb NOT NULL,
    extracted_data jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.pending_tickets OWNER TO neondb_owner;

--
-- Name: pending_tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.pending_tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pending_tickets_id_seq OWNER TO neondb_owner;

--
-- Name: pending_tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.pending_tickets_id_seq OWNED BY public.pending_tickets.id;


--
-- Name: session; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.session (
    sid character varying NOT NULL,
    sess json NOT NULL,
    expire timestamp(6) without time zone NOT NULL
);


ALTER TABLE public.session OWNER TO neondb_owner;

--
-- Name: tickets; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.tickets (
    id integer NOT NULL,
    user_id integer NOT NULL,
    event_name text NOT NULL,
    event_date text NOT NULL,
    venue text NOT NULL,
    section text NOT NULL,
    "row" text NOT NULL,
    seat text NOT NULL,
    asking_price integer NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.tickets OWNER TO neondb_owner;

--
-- Name: tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tickets_id_seq OWNER TO neondb_owner;

--
-- Name: tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.tickets_id_seq OWNED BY public.tickets.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    "uniqueEmail" character varying(255) NOT NULL,
    "isAdmin" boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    email text DEFAULT ''::text NOT NULL
);


ALTER TABLE public.users OWNER TO neondb_owner;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO neondb_owner;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: payments id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);


--
-- Name: pendingTickets id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."pendingTickets" ALTER COLUMN id SET DEFAULT nextval('public."pendingTickets_id_seq"'::regclass);


--
-- Name: pending_tickets id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pending_tickets ALTER COLUMN id SET DEFAULT nextval('public.pending_tickets_id_seq'::regclass);


--
-- Name: tickets id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tickets ALTER COLUMN id SET DEFAULT nextval('public.tickets_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.payments (id, user_id, ticket_id, amount, status, created_at) FROM stdin;
\.


--
-- Data for Name: pendingTickets; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public."pendingTickets" (id, user_id, recipient_email, event_name, event_date, event_time, venue, city, state, section, "row", seat, email_subject, email_from, raw_email_data, extracted_data, status, created_at) FROM stdin;
\.


--
-- Data for Name: pending_tickets; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.pending_tickets (id, user_id, email_subject, email_from, raw_email_data, extracted_data, status, created_at) FROM stdin;
1	3	Test Event - Section A	test@example.com	{"to": "testd.87c4c91b5b5f@seatxfer.com", "from": "test@example.com", "parsed": {"row": "1", "date": "2025-03-01", "seat": "10", "venue": "Test Arena", "section": "A"}, "subject": "Test Event - Section A"}	{"row": "1", "seat": "10", "venue": "Test Arena", "section": "A", "eventDate": "2025-03-01", "eventName": "Test Event"}	processed	2025-02-25 01:44:14.037386
2	3	Test Event - Section A	test@example.com	{"to": "testd.87c4c91b5b5f@seatxfer.com", "from": "test@example.com", "parsed": {"row": "1", "date": "2025-03-01", "seat": "10", "venue": "Test Arena", "section": "A"}, "subject": "Test Event - Section A"}	{"row": "1", "seat": "10", "venue": "Test Arena", "section": "A", "eventDate": "2025-03-01", "eventName": "Test Event"}	processed	2025-02-25 15:38:38.961589
\.


--
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.session (sid, sess, expire) FROM stdin;
Op9waY1iqK-KMY2JDGNR5reKJ9D4ny3e	{"cookie":{"originalMaxAge":null,"expires":null,"httpOnly":true,"path":"/"},"passport":{"user":9}}	2025-02-28 01:39:29
vaiQZ2pGwDhZsUwte6CEDzKdfx8nIWJg	{"cookie":{"originalMaxAge":null,"expires":null,"httpOnly":true,"path":"/"},"passport":{"user":9}}	2025-02-28 00:43:59
_aGcnfLdt0ypO1HnFrwxQ4QY7htAyHkl	{"cookie":{"originalMaxAge":null,"expires":null,"httpOnly":true,"path":"/"},"passport":{"user":9}}	2025-02-28 14:13:30
\.


--
-- Data for Name: tickets; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.tickets (id, user_id, event_name, event_date, venue, section, "row", seat, asking_price, status, created_at) FROM stdin;
1	3	beyonce						0	pending	2025-02-24 21:43:39.626307
2	3	Test Event	2025-03-01	Test Arena	A	1	10	0	pending	2025-02-25 01:44:49.495054
3	3	Test Event	2025-03-01	Test Arena	A	1	10	0	pending	2025-02-25 15:41:41.853921
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.users (id, username, password, "uniqueEmail", "isAdmin", created_at, email) FROM stdin;
5	admin	5fdbe21ec6f8b7d52dd66a4b5c1c0cdd0348e176af7132486386bca5824194c864efdd22e91a3f3311d59749d6b7d24e9b77f53f8fa477937b575db9b1749791.7d93c950766df424a5ef1f49ba7a5454	admin.e37da97b6638@seatxfer.com	f	2025-02-26 19:34:07.839546	
9	mike	c4bfac97fae397ac010e0f3683bfa507f8ed10bc56708ff90da3d4bcb84d8175f944db63cccb050906e4c34cb0ed7f79ea12342fbab3f446d5be0c8957fe5e41.a1d7bcd05cbfb047eedaf164451bcf59	mike.b442b9c0aa87@seatxfer.com	t	2025-02-26 23:24:10.073175	mike2@fanhelp.org
2	testc	0cfe2587ba7c203c1f5f40d6d6e43549a52b7ae3116e2016120fd4fa3b33b13fbb58b960e080b02479fe833ff9ee9f67db09bace87a8fa02f36cfdb767092f61.4268afa895a310b5c0240cb83f15ed9f	testc.d40d46085e3e@seatxfer.com	f	2025-02-26 19:34:07.839546	
3	testd	0cfe2587ba7c203c1f5f40d6d6e43549a52b7ae3116e2016120fd4fa3b33b13fbb58b960e080b02479fe833ff9ee9f67db09bace87a8fa02f36cfdb767092f61.4268afa895a310b5c0240cb83f15ed9f	testd.87c4c91b5b5f@seatxfer.com	f	2025-02-26 19:34:07.839546	
1	testb	0cfe2587ba7c203c1f5f40d6d6e43549a52b7ae3116e2016120fd4fa3b33b13fbb58b960e080b02479fe833ff9ee9f67db09bace87a8fa02f36cfdb767092f61.4268afa895a310b5c0240cb83f15ed9f	testb.a7e9d58864af@seatxfer.com	t	2025-02-26 19:34:07.839546	
4	testf	0cfe2587ba7c203c1f5f40d6d6e43549a52b7ae3116e2016120fd4fa3b33b13fbb58b960e080b02479fe833ff9ee9f67db09bace87a8fa02f36cfdb767092f61.4268afa895a310b5c0240cb83f15ed9f	testf.585958134f3f@seatxfer.com	f	2025-02-26 19:34:07.839546	
7	testg	0cfe2587ba7c203c1f5f40d6d6e43549a52b7ae3116e2016120fd4fa3b33b13fbb58b960e080b02479fe833ff9ee9f67db09bace87a8fa02f36cfdb767092f61.4268afa895a310b5c0240cb83f15ed9f	testg.a0e6ace9ebdc@seatxfer.com	f	2025-02-26 20:56:25.893956	
8	testh	0cfe2587ba7c203c1f5f40d6d6e43549a52b7ae3116e2016120fd4fa3b33b13fbb58b960e080b02479fe833ff9ee9f67db09bace87a8fa02f36cfdb767092f61.4268afa895a310b5c0240cb83f15ed9f	testh.55a67ee58ef0@seatxfer.com	f	2025-02-26 22:53:03.13464	testh@fanhelp.org
\.


--
-- Name: payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.payments_id_seq', 1, false);


--
-- Name: pendingTickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public."pendingTickets_id_seq"', 1, false);


--
-- Name: pending_tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.pending_tickets_id_seq', 2, true);


--
-- Name: tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.tickets_id_seq', 3, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.users_id_seq', 9, true);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: pendingTickets pendingTickets_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."pendingTickets"
    ADD CONSTRAINT "pendingTickets_pkey" PRIMARY KEY (id);


--
-- Name: pending_tickets pending_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.pending_tickets
    ADD CONSTRAINT pending_tickets_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (sid);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_uniqueemail_unique; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_uniqueemail_unique UNIQUE ("uniqueEmail");


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


--
-- Name: pendingTickets pendingTickets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public."pendingTickets"
    ADD CONSTRAINT "pendingTickets_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON TABLES TO neon_superuser WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--

