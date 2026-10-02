BEGIN;

INSERT INTO public.equipment_items (id, name, category, subcategory, data)
SELECT id, name, 'gear', 'Bugiganga assombrada',
  jsonb_build_object(
    'id', id,
    'name', name,
    'category', 'gear',
    'subcategory', 'Bugiganga assombrada',
    'priceCp', null,
    'weightKg', null,
    'unit', 'unidade',
    'description', description,
    'properties', '[]'::jsonb,
    'sourcePage', 220,
    'aliases', '[]'::jsonb
  )
FROM (VALUES
  ('haunted-trinket-67', 'Bugiganga assombrada (67)', 'Uma armadilha de dedo de bronze esculpida com tigres rugindo.'),
  ('haunted-trinket-68', 'Bugiganga assombrada (68)', 'Um colar de pérolas que fica vermelho sob a lua cheia.'),
  ('haunted-trinket-69', 'Bugiganga assombrada (69)', 'Um fóssil de peixe com traços humanoides.'),
  ('haunted-trinket-70', 'Bugiganga assombrada (70)', 'Uma máscara de médico da peste.'),
  ('haunted-trinket-71', 'Bugiganga assombrada (71)', 'Um talismã de papel com tinta borrada.'),
  ('haunted-trinket-72', 'Bugiganga assombrada (72)', 'Um relicário com a imagem borrada de uma figura sem olhos.'),
  ('haunted-trinket-73', 'Bugiganga assombrada (73)', 'Um vaso canópico com tampa esculpida como uma cabra.'),
  ('haunted-trinket-74', 'Bugiganga assombrada (74)', 'Uma lanterna de abóbora feita de uma pequena cabaça pálida.'),
  ('haunted-trinket-75', 'Bugiganga assombrada (75)', 'Um único sapato de ferro com salto alto.'),
  ('haunted-trinket-76', 'Bugiganga assombrada (76)', 'Uma vela feita de uma mão decepada.'),
  ('haunted-trinket-77', 'Bugiganga assombrada (77)', 'Um dispositivo mecânico que pulsa como um coração.'),
  ('haunted-trinket-78', 'Bugiganga assombrada (78)', 'Uma máscara de baile sem rosto.'),
  ('haunted-trinket-79', 'Bugiganga assombrada (79)', 'Um olho de vidro com um verme vivo dentro.'),
  ('haunted-trinket-80', 'Bugiganga assombrada (80)', 'Um lençol com dois buracos para os olhos.'),
  ('haunted-trinket-81', 'Bugiganga assombrada (81)', 'A escritura de um lugar chamado Solar Tergeron.'),
  ('haunted-trinket-82', 'Bugiganga assombrada (82)', 'Um envelope carmesim ornamentado e selado com cera, resistente a qualquer tentativa de abertura.'),
  ('haunted-trinket-83', 'Bugiganga assombrada (83)', 'Um véu de luto adornado com renda preta.'),
  ('haunted-trinket-84', 'Bugiganga assombrada (84)', 'Uma camisa de força coberta de runas de carvão.'),
  ('haunted-trinket-85', 'Bugiganga assombrada (85)', 'Uma máscara esfarrapada de estopa com um sorriso torto pintado.'),
  ('haunted-trinket-86', 'Bugiganga assombrada (86)', 'Uma fita verde feita para ser usada como gargantilha.'),
  ('haunted-trinket-87', 'Bugiganga assombrada (87)', 'Uma dentadura com dentes afiados e incompatíveis entre si.'),
  ('haunted-trinket-88', 'Bugiganga assombrada (88)', 'Uma bolsa de ovos morna do tamanho de um punho.'),
  ('haunted-trinket-89', 'Bugiganga assombrada (89)', 'Um anel de cobre com a palavra “meu” gravada por dentro.'),
  ('haunted-trinket-90', 'Bugiganga assombrada (90)', 'Uma ampola de vidro com um líquido verde-neon.'),
  ('haunted-trinket-91', 'Bugiganga assombrada (91)', 'Um tapa-olho bordado com um símbolo sagrado.'),
  ('haunted-trinket-92', 'Bugiganga assombrada (92)', 'Um dedão do pé decepado cuja unha continua crescendo.'),
  ('haunted-trinket-93', 'Bugiganga assombrada (93)', 'Um diário com muitas passagens censuradas.'),
  ('haunted-trinket-94', 'Bugiganga assombrada (94)', 'Uma luva com um desenho semelhante a uma boca costurado na palma.'),
  ('haunted-trinket-95', 'Bugiganga assombrada (95)', 'Um relicário ornamentado, porém vazio, feito de prata e vidro estilhaçado.'),
  ('haunted-trinket-96', 'Bugiganga assombrada (96)', 'Uma figura de cerâmica de um gato com olhos demais.'),
  ('haunted-trinket-97', 'Bugiganga assombrada (97)', 'Um ingresso de papel amassado com as palavras “não admita ninguém”.'),
  ('haunted-trinket-98', 'Bugiganga assombrada (98)', 'Uma moeda de electrum com seu rosto em um dos lados.'),
  ('haunted-trinket-99', 'Bugiganga assombrada (99)', 'Uma cabeça encolhida de gremishka que se contorce quando alguém conjura magia por perto.'),
  ('haunted-trinket-100', 'Bugiganga assombrada (100)', 'Um amuleto em forma de sol com uma pedra vermelha no centro.')
) AS trinkets(id, name, description)
ON CONFLICT (id) DO UPDATE
SET name = excluded.name,
    category = excluded.category,
    subcategory = excluded.subcategory,
    data = excluded.data;

COMMIT;
