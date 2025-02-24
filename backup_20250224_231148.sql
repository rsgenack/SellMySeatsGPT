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
    email text NOT NULL,
    unique_email text
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
-- Data for Name: pending_tickets; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.pending_tickets (id, user_id, email_subject, email_from, raw_email_data, extracted_data, status, created_at) FROM stdin;
\.


--
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.session (sid, sess, expire) FROM stdin;
15HvZfus40yuFpxxw02l7nn2LOvuqxxq	{"cookie":{"originalMaxAge":null,"expires":null,"httpOnly":true,"path":"/"},"passport":{"user":1}}	2025-02-25 20:07:20
TvSjOCMTcnJ6XOCqW1So8g-Dcf87yJDQ	{"cookie":{"originalMaxAge":null,"expires":null,"httpOnly":true,"path":"/"},"passport":{"user":3}}	2025-02-25 23:08:01
\.


--
-- Data for Name: tickets; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.tickets (id, user_id, event_name, event_date, venue, section, "row", seat, asking_price, status, created_at) FROM stdin;
1	3	beyonce						0	pending	2025-02-24 21:43:39.626307
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: neondb_owner
--

COPY public.users (id, username, password, email, unique_email) FROM stdin;
1	testb	e23bf18cbe5e888ca3e2c73d678245d7cc6748fc33fbbb76b7c5122d108d31d60a61e1c4b52d1df8afa788436d6a3e415379d42e382580df972200cc0b491f00.db7724836d3fbb9829196b72c7349128	testb@fanhelp.org	testb.a7e9d58864af@sellmyseats.com
2	testc	a5377aeb941fcbf99e3533d8e22481132fd3b2fd1449429c9d396f0ec8dda926dd75df86f211acfd26f18c2ded11ca3141549a8ab5f1940086e1106e98f6bd55.45b9e2270d0d2bb33748116389122d87	testc@fanhelp.org	testc.d40d46085e3e@seatxfer.com
3	testd	cb7064a25de998cde702736d73b7f50413550ef2ae5aa2bc312c4df8bb8f9732a3de45edb6d996137016a40c8a17e2adbcdf8b12eec97754f4749d1039a31dcb.e25ad0843325d7e2ca8b5f24911be919	testd@fanhelp.org	testd.87c4c91b5b5f@seatxfer.com
\.


--
-- Name: payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.payments_id_seq', 1, false);


--
-- Name: pending_tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.pending_tickets_id_seq', 1, false);


--
-- Name: tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.tickets_id_seq', 1, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: neondb_owner
--

SELECT pg_catalog.setval('public.users_id_seq', 3, true);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


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
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX "IDX_session_expire" ON public.session USING btree (expire);


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

