-- Seed de categorias y productos
-- PostgreSQL

-- =====================
-- CATEGORIAS
-- =====================
INSERT INTO public.categorias (id, nombre, descripcion, imagen, activo, orden, created_at) VALUES
(1, 'leggings', 'Leggings deportivos de alta compresión', NULL, true, 1, '2025-12-30 03:57:19.64898'),
(2, 'tops', 'Tops y sujetadores deportivos', NULL, true, 2, '2025-12-30 03:57:19.64898'),
(3, 'sets', 'Sets completos de ropa deportiva', NULL, true, 3, '2025-12-30 03:57:19.64898'),
(4, 'shorts', 'Shorts para running y entrenamiento', NULL, true, 4, '2025-12-30 03:57:19.64898'),
(5, 'accesorios', 'Accesorios deportivos', NULL, true, 5, '2025-12-30 03:57:19.64898'),
(6, 'jackets', 'Chaquetas y abrigos deportivos', NULL, true, 6, '2025-12-30 03:57:19.64898'),
(7, 'pants', 'Pantalones deportivos', NULL, true, 7, '2025-12-30 03:57:19.64898'),
(8, 'sports-bras', 'Sports bras con soporte', NULL, true, 8, '2025-12-30 03:57:19.64898'),
(9, 'new-collection', 'Nueva colección', NULL, true, 9, '2025-12-30 03:57:19.64898'),
(10, 'sale', 'Productos en oferta', NULL, true, 10, '2025-12-30 03:57:19.64898')
ON CONFLICT DO NOTHING;

-- =====================
-- PRODUCTOS
-- =====================
INSERT INTO public.productos (
id, nombre, descripcion, precio, categoria,
imagen_principal, tallas, colores, stock,
activo, descuento, created_at, updated_at,
sku, material, codigo, imagenes, precio_final
) VALUES
(1,'Legging Power Flex','Legging de alta compresión con tecnología dry-fit',2690.42,'leggings','public/images/products/legging1.jpg','{XS,S,M,L}','{Negro,Blanco,Gris}',50,true,0,'2025-12-19','2026-01-13',NULL,NULL,NULL,'{}',2690.42),

(2,'Top Energy Pro','Top deportivo con soporte máximo',1929.92,'tops','public/images/products/top1.jpg','{XS,S,M,L,XL}','{Negro,Blanco,Gris}',30,true,0,'2025-12-19','2026-01-13',NULL,NULL,NULL,'{}',1929.92),

(3,'Set Active Black','Set completo para entrenamiento',4445.42,'sets','public/images/products/set1.jpg','{XS,S,M,L,XL}','{Negro,Blanco,Gris}',20,false,4,'2025-12-19','2026-01-13',NULL,NULL,NULL,'{}',4445.42),

(4,'Short Performance','Short deportivo con bolsillos',1695.92,'shorts','public/images/products/short1.jpg','{XS,S,M,L,XL}','{Negro,Blanco,Gris}',40,true,0,'2025-12-19','2026-01-13',NULL,NULL,NULL,'{}',1695.92),

(5,'Set de cuatro colores','Set de 4 colores',2340.00,'sets','https://i.pinimg.com/1200x/8f/06/7b/8f067b5c47ba7fc4167ec1d2f6755f07.jpg','{}','{}',10,true,0,'2025-12-29','2026-01-13','09',NULL,NULL,'{}',2340.00),

(6,'Top de cuello','Top cuello alto',1170.00,'tops','https://i.pinimg.com/1200x/a2/aa/a4/a2aaa4c7497cf386d77be32a5d8aab12.jpg','{XS,S,M}','{Negro,Blanco,Gris}',10,true,0,'2025-12-29','2026-01-13','MB-01',NULL,NULL,'{}',1170.00)
ON CONFLICT DO NOTHING;

