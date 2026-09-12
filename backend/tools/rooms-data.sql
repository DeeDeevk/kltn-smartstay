--
-- ViKaHotel - Dump du lieu Loai phong (RoomType) + Phong (Room)
-- Nguon: DB "vikahotel" cua Vinh. Xuat bang: pg_dump --data-only --column-inserts
--
-- CACH IMPORT (Khoa chay):
--   1. Bat backend 1 lan de TypeORM tu tao schema (DB_SYNCHRONIZE=true), roi tat di.
--   2. psql -h localhost -p <port> -U postgres -d vikahotel -f rooms-data.sql
--      (Windows co the dung: & "C:\Program Files\PostgreSQL\18\bin\psql.exe" ... )
--   3. Neu bang da co du lieu cu, xoa truoc khi import:
--        TRUNCATE public."Room", public."RoomType" RESTART IDENTITY CASCADE;
--
--
-- PostgreSQL database dump
--


-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: RoomType; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."RoomType" ("roomTypeId", name, description, "basePrice", capacity, amenities, images, status, "createdAt", "updatedAt") VALUES ('475e69a3-2df9-4684-8f69-334a210a7e27', 'Deluxe Ocean View', 'Phòng nghỉ rộng rãi với view biển và nội thất hiện đại, phù hợp cho cặp đôi hoặc khách công tác muốn tận hưởng không gian yên tĩnh, thoáng đãng.', 2500000, 2, '["Wifi miễn phí", "Điều hòa", "TV màn hình phẳng", "Minibar", "Máy pha cà phê", "Ban công riêng"]', '["https://res.cloudinary.com/dopu897an/image/upload/v1787557871/vikahotel/room-types/oahewytghasfv0kuukqa.jpg", "https://res.cloudinary.com/dopu897an/image/upload/v1787557872/vikahotel/room-types/vot5ibplqtb1i6y4bnrw.jpg", "https://res.cloudinary.com/dopu897an/image/upload/v1787557859/vikahotel/room-types/skhozxlsd47gyolb3o8l.jpg", "https://res.cloudinary.com/dopu897an/image/upload/v1787557860/vikahotel/room-types/tmqotnkh2oyddnqecrb8.jpg"]', 'ACTIVE', '2026-08-24 14:52:08.260022', '2026-08-24 14:52:08.260022');
INSERT INTO public."RoomType" ("roomTypeId", name, description, "basePrice", capacity, amenities, images, status, "createdAt", "updatedAt") VALUES ('870eb211-f132-4ff0-8035-f93e7c5758d7', 'Premier Family Suite', 'Lựa chọn lý tưởng cho gia đình với không gian thoải mái, khu vực sinh hoạt chung riêng biệt và tầm nhìn đẹp ra thành phố.', 3800000, 4, '["Wifi miễn phí", "Điều hòa", "TV màn hình phẳng", "Minibar", "Phòng khách riêng", "Bồn tắm", "Dịch vụ dọn phòng hàng ngày"]', '["https://res.cloudinary.com/dopu897an/image/upload/v1787557867/vikahotel/room-types/fokzhxpuctzt4xgu0swj.jpg", "https://res.cloudinary.com/dopu897an/image/upload/v1787557870/vikahotel/room-types/sdj0qvtwcjete28y9ryd.jpg", "https://res.cloudinary.com/dopu897an/image/upload/v1787557861/vikahotel/room-types/w7jsvicfusvknvfwzvfh.jpg", "https://res.cloudinary.com/dopu897an/image/upload/v1787557862/vikahotel/room-types/ocunaxotvnajl8ah6iuk.jpg"]', 'ACTIVE', '2026-08-24 14:52:08.428672', '2026-08-24 14:52:08.428672');
INSERT INTO public."RoomType" ("roomTypeId", name, description, "basePrice", capacity, amenities, images, status, "createdAt", "updatedAt") VALUES ('cc110b00-7ea6-44c4-aa01-cc7d530effe7', 'Executive City View', 'Phù hợp cho khách công tác, vị trí đẹp và tiện nghi đầy đủ, không gian làm việc thoải mái cùng dịch vụ cao cấp.', 3100000, 2, '["Wifi miễn phí", "Điều hòa", "TV màn hình phẳng", "Minibar", "Bàn làm việc", "Két an toàn", "Dịch vụ giặt ủi"]', '["https://res.cloudinary.com/dopu897an/image/upload/v1787557866/vikahotel/room-types/q9k5cpgnm1drmz4ropk5.jpg", "https://res.cloudinary.com/dopu897an/image/upload/v1787557868/vikahotel/room-types/zkvgbos0jq3vaslat7vn.jpg", "https://res.cloudinary.com/dopu897an/image/upload/v1787557865/vikahotel/room-types/u24jxvahhucknbc2ho4w.jpg", "https://res.cloudinary.com/dopu897an/image/upload/v1787557864/vikahotel/room-types/c6ipbfb2nxhj8d8r6use.jpg"]', 'ACTIVE', '2026-08-24 14:52:08.506754', '2026-08-24 14:52:08.506754');
INSERT INTO public."RoomType" ("roomTypeId", name, description, "basePrice", capacity, amenities, images, status, "createdAt", "updatedAt") VALUES ('04e2c857-c8c6-4a5a-80ff-83837a004224', 'Deluxe Room', 'Không gian rộng rãi hơn với tầm nhìn đẹp, lựa chọn giường King hoặc 2 giường đơn linh hoạt theo nhu cầu. Phù hợp cho cặp đôi hoặc khách muốn tận hưởng kỳ nghỉ thoải mái hơn.', 1800000, 3, '["Giường King hoặc 2 giường đơn", "Diện tích 30m²", "Tầm nhìn đẹp", "Wifi miễn phí", "Điều hòa", "TV màn hình phẳng", "Minibar"]', '["https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?q=80&w=1600&auto=format&fit=crop"]', 'ACTIVE', '2026-08-24 20:34:44.396796', '2026-08-24 20:44:11.766552');
INSERT INTO public."RoomType" ("roomTypeId", name, description, "basePrice", capacity, amenities, images, status, "createdAt", "updatedAt") VALUES ('49282abb-44f5-4561-a273-832fe28c49c0', 'Family Suite', 'Căn hộ suite với 1-2 phòng ngủ riêng biệt, không gian sinh hoạt chung thoải mái — lựa chọn lý tưởng cho gia đình hoặc nhóm bạn đi du lịch cùng nhau.', 2800000, 4, '["1-2 phòng ngủ riêng", "Diện tích 45m²", "Phòng khách riêng", "Wifi miễn phí", "Điều hòa", "TV màn hình phẳng", "Minibar"]', '["https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=1600&auto=format&fit=crop"]', 'ACTIVE', '2026-08-24 20:34:44.466199', '2026-08-24 20:44:11.780302');
INSERT INTO public."RoomType" ("roomTypeId", name, description, "basePrice", capacity, amenities, images, status, "createdAt", "updatedAt") VALUES ('9a4c6fee-2380-44ee-9d05-fe6bfb10b4b7', 'Executive Suite', 'Hạng phòng cao cấp nhất tại Vika Hotel, dành riêng cho những vị khách đề cao sự đẳng cấp. Phòng khách riêng biệt, ban công view đẹp, cùng các tiện ích 5 sao chu đáo.', 4500000, 2, '["Phòng khách riêng", "Ban công riêng", "Diện tích 55m²", "Minibar", "Bồn tắm", "Dịch vụ dọn phòng hàng ngày", "Wifi miễn phí", "Điều hòa", "TV màn hình phẳng"]', '["https://images.unsplash.com/photo-1616594039964-ae9021a400a0?q=80&w=1600&auto=format&fit=crop"]', 'ACTIVE', '2026-08-24 20:34:44.541857', '2026-08-24 20:44:11.797553');
INSERT INTO public."RoomType" ("roomTypeId", name, description, "basePrice", capacity, amenities, images, status, "createdAt", "updatedAt") VALUES ('b3afb627-b52d-4d3f-a094-c8dc4b14bb8b', 'Standard Room', 'Lựa chọn tiết kiệm và thoải mái nhất, phù hợp cho khách đi công tác hoặc nghỉ ngắn ngày. Giường Queen êm ái, không gian gọn gàng, đầy đủ tiện nghi cơ bản.', 3000, 1, '["Giường Queen", "Diện tích 22m²", "Wifi miễn phí", "Điều hòa", "TV màn hình phẳng"]', '["https://images.unsplash.com/photo-1631049307264-da0ec9d70304?q=80&w=1600&auto=format&fit=crop"]', 'ACTIVE', '2026-08-24 15:24:21.479398', '2026-08-24 20:48:59.588753');
INSERT INTO public."RoomType" ("roomTypeId", name, description, "basePrice", capacity, amenities, images, status, "createdAt", "updatedAt") VALUES ('8f217d83-ced2-44a6-be9d-969925ec5f3e', 'Standard Room', 'Lựa chọn tiết kiệm và thoải mái nhất, phù hợp cho khách đi công tác hoặc nghỉ ngắn ngày. Giường Queen êm ái, không gian gọn gàng, đầy đủ tiện nghi cơ bản.', 1200000, 2, '["Giường Queen", "Diện tích 22m²", "Wifi miễn phí", "Điều hòa", "TV màn hình phẳng"]', '["https://images.unsplash.com/photo-1631049307264-da0ec9d70304?q=80&w=1600&auto=format&fit=crop"]', 'INACTIVE', '2026-08-24 20:34:43.795995', '2026-08-24 20:52:41.569637');


--
-- Data for Name: Room; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Room" ("roomId", "roomNumber", floor, status, "createdAt", "updatedAt", "roomTypeId") VALUES ('4b3c7ea6-45b8-4608-a789-ea320de0dd09', 'E01', 2, 'AVAILABLE', '2026-08-24 17:24:51.654047', '2026-08-24 17:24:51.654047', 'cc110b00-7ea6-44c4-aa01-cc7d530effe7');
INSERT INTO public."Room" ("roomId", "roomNumber", floor, status, "createdAt", "updatedAt", "roomTypeId") VALUES ('cbf221af-31c6-4a08-bb50-5e1fbd443b14', 'E02', 2, 'AVAILABLE', '2026-08-24 17:24:51.749126', '2026-08-24 17:24:51.749126', 'cc110b00-7ea6-44c4-aa01-cc7d530effe7');
INSERT INTO public."Room" ("roomId", "roomNumber", floor, status, "createdAt", "updatedAt", "roomTypeId") VALUES ('223b1b84-2fa5-4e69-ad1f-5730742e3acd', 'E03', 2, 'AVAILABLE', '2026-08-24 17:24:51.834111', '2026-08-24 17:24:51.834111', 'cc110b00-7ea6-44c4-aa01-cc7d530effe7');
INSERT INTO public."Room" ("roomId", "roomNumber", floor, status, "createdAt", "updatedAt", "roomTypeId") VALUES ('6fd4cfcd-3998-4161-a0c5-6289ceadd641', 'P01', 2, 'AVAILABLE', '2026-08-24 17:24:51.898266', '2026-08-24 17:24:51.898266', '870eb211-f132-4ff0-8035-f93e7c5758d7');
INSERT INTO public."Room" ("roomId", "roomNumber", floor, status, "createdAt", "updatedAt", "roomTypeId") VALUES ('2d91adf4-c599-4cb7-b4a1-4bc521a88839', 'P02', 2, 'AVAILABLE', '2026-08-24 17:24:51.971786', '2026-08-24 17:24:51.971786', '870eb211-f132-4ff0-8035-f93e7c5758d7');
INSERT INTO public."Room" ("roomId", "roomNumber", floor, status, "createdAt", "updatedAt", "roomTypeId") VALUES ('1ed9b644-778e-4536-9230-0fd691e83435', 'P03', 2, 'AVAILABLE', '2026-08-24 17:24:52.048098', '2026-08-24 17:24:52.048098', '870eb211-f132-4ff0-8035-f93e7c5758d7');
INSERT INTO public."Room" ("roomId", "roomNumber", floor, status, "createdAt", "updatedAt", "roomTypeId") VALUES ('b0c97b05-fbe8-4896-b6fe-881daeb541d6', 'D01', 2, 'AVAILABLE', '2026-08-24 17:24:52.107272', '2026-08-24 17:24:52.107272', '475e69a3-2df9-4684-8f69-334a210a7e27');
INSERT INTO public."Room" ("roomId", "roomNumber", floor, status, "createdAt", "updatedAt", "roomTypeId") VALUES ('0347bc1b-ed86-463b-9168-94ce2c81ebe7', 'D02', 2, 'AVAILABLE', '2026-08-24 17:24:52.167711', '2026-08-24 17:24:52.167711', '475e69a3-2df9-4684-8f69-334a210a7e27');
INSERT INTO public."Room" ("roomId", "roomNumber", floor, status, "createdAt", "updatedAt", "roomTypeId") VALUES ('3c9c5a0b-2f48-4b22-9b5a-807d5d2e6ad6', 'D03', 2, 'AVAILABLE', '2026-08-24 17:24:52.225062', '2026-08-24 17:24:52.225062', '475e69a3-2df9-4684-8f69-334a210a7e27');
INSERT INTO public."Room" ("roomId", "roomNumber", floor, status, "createdAt", "updatedAt", "roomTypeId") VALUES ('73b89953-c891-4197-9b38-82cf202e7bf2', '301', 1, 'AVAILABLE', '2026-08-24 20:27:09.136584', '2026-08-24 20:27:09.136584', 'cc110b00-7ea6-44c4-aa01-cc7d530effe7');
INSERT INTO public."Room" ("roomId", "roomNumber", floor, status, "createdAt", "updatedAt", "roomTypeId") VALUES ('72357074-f8a9-45d0-837c-22527f2820e6', '200', 1, 'AVAILABLE', '2026-08-24 21:31:54.942271', '2026-08-24 21:31:54.942271', '04e2c857-c8c6-4a5a-80ff-83837a004224');
INSERT INTO public."Room" ("roomId", "roomNumber", floor, status, "createdAt", "updatedAt", "roomTypeId") VALUES ('038510c7-2826-4e68-9d11-ea40e95e3dcc', 'T01', 1, 'CLEANING', '2026-08-24 15:25:08.804863', '2026-09-07 20:32:08.869004', 'b3afb627-b52d-4d3f-a094-c8dc4b14bb8b');
INSERT INTO public."Room" ("roomId", "roomNumber", floor, status, "createdAt", "updatedAt", "roomTypeId") VALUES ('ceff02d1-d8c7-4713-be5b-07deaa2d2168', 'T02', 1, 'CLEANING', '2026-08-24 15:25:09.024805', '2026-09-07 20:39:39.018263', 'b3afb627-b52d-4d3f-a094-c8dc4b14bb8b');
INSERT INTO public."Room" ("roomId", "roomNumber", floor, status, "createdAt", "updatedAt", "roomTypeId") VALUES ('b8c541f6-cf48-444d-a2a4-9d958a13f17c', '300', 1, 'CLEANING', '2026-09-07 20:46:52.962072', '2026-09-07 20:48:44.230719', 'b3afb627-b52d-4d3f-a094-c8dc4b14bb8b');
INSERT INTO public."Room" ("roomId", "roomNumber", floor, status, "createdAt", "updatedAt", "roomTypeId") VALUES ('1a95c87d-14e5-4f53-8db8-5e8f8f54bef2', '1', 1, 'AVAILABLE', '2026-08-24 21:30:51.060982', '2026-09-07 21:01:42.097085', '9a4c6fee-2380-44ee-9d05-fe6bfb10b4b7');


--
-- PostgreSQL database dump complete
--


