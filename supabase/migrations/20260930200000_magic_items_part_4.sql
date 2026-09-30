BEGIN;

-- The base catalog already has the common healing potion with its existing price.
-- Keep that price and promote the existing record into the magic-item catalog.
UPDATE public.equipment_items
SET category = 'magic',
    subcategory = 'Poções',
    data = data || jsonb_build_object(
      'category', 'magic',
      'subcategory', 'Poções',
      'rarity', 'variável',
      'attunement', NULL,
      'description', 'Recupera pontos de vida conforme a variante: Cura, comum, 2d4+2; Cura Maior, incomum, 4d4+4; Cura Superior, rara, 8d4+8; Cura Suprema, muito rara, 10d4+20.'
    )
WHERE id = 'pocao-de-cura' AND category = 'gear';

INSERT INTO public.equipment_items (id, name, category, subcategory, data)
SELECT id, name, 'magic', subcategory,
  jsonb_build_object(
    'id', id,
    'name', name,
    'category', 'magic',
    'subcategory', subcategory,
    'rarity', rarity,
    'attunement', attunement,
    'priceCp', NULL,
    'weightKg', NULL,
    'unit', 'unidade',
    'description', description,
    'properties', ARRAY[]::text[],
    'sourcePage', NULL,
    'aliases', ARRAY[]::text[]
  )
FROM (VALUES
  ('matador-de-gigantes', 'Matador de Gigantes', 'Armas mágicas', 'raro', NULL, 'Machado ou espada mágica +1. Ao atingir uma criatura do tipo gigante, causa 2d6 de dano adicional do tipo da arma e o alvo deve passar em teste de Força CD 15 ou cair. Ettins e trolls contam como gigantes.'),
  ('medalhao-de-pensamentos', 'Medalhão de Pensamentos', 'Medalhões', 'incomum', 'sim', 'Possui 3 cargas. Com uma ação e 1 carga, conjura detectar pensamentos (CD 13). Recupera 1d3 cargas ao amanhecer.'),
  ('mochila-de-carga', 'Mochila de Carga', 'Bolsas', 'incomum', NULL, 'Espaço extradimensional que comporta até 250 kg e 20 m³, mas pesa sempre 7,5 kg; retirar algo exige uma ação. Se sobrecarregada, perfurada ou rasgada, é destruída e espalha o conteúdo no Plano Astral; virada do avesso, despeja-o ileso. Criaturas dentro têm ar por 10 dividido pela quantidade de criaturas minutos, mínimo 1. Colocá-la dentro de outro espaço extradimensional destrói ambos e abre portal de via única para o Plano Astral, sugando criaturas a até 3 m.'),
  ('municao-magica', 'Munição Mágica', 'Munições mágicas', 'variável', NULL, 'Munição mágica com bônus indicado nas jogadas de ataque e dano; depois de atingir um alvo, deixa de ser mágica. Variantes: +1 (incomum), +2 (rara) e +3 (muito rara).'),
  ('oleo-de-forma-eterea', 'Óleo de Forma Etérea', 'Poções', 'rara', NULL, 'Um frasco cobre uma criatura Média ou menor e seu equipamento; é necessário um frasco adicional por categoria de tamanho acima de Médio. Aplicar leva 10 minutos e produz o efeito de forma etérea por 1 hora.'),
  ('oleo-de-precisao', 'Óleo de Precisão', 'Poções', 'muito raro', NULL, 'Cobre uma arma cortante ou perfurante, ou até cinco munições desses tipos. Aplicar leva 1 minuto; por 1 hora, o objeto torna-se mágico e recebe +3 nas jogadas de ataque e dano.'),
  ('oleo-escorregadio', 'Óleo Escorregadio', 'Poções', 'incomum', NULL, 'Um frasco cobre uma criatura Média ou menor e seu equipamento; é necessário um frasco adicional por categoria de tamanho acima de Médio. Aplicar leva 10 minutos e concede os efeitos de movimentação livre por 8 horas. Alternativamente, uma ação espalha o óleo sobre 3 m², reproduzindo área escorregadia por 8 horas.'),
  ('pedra-da-boa-sorte', 'Pedra da Boa Sorte', 'Pedras', 'incomum', 'sim', 'Enquanto a ágata estiver em sua posse, concede +1 em testes de habilidade e testes de resistência.'),
  ('pedra-de-comandar-elementais-da-terra', 'Pedra de Comandar Elementais da Terra', 'Pedras', 'raro', NULL, 'Pesa 2,5 kg. Tocada no solo, permite invocar um elemental da terra com uma ação e palavra de comando, como conjurar elemental. Recarrega no amanhecer seguinte.'),
  ('pedra-ionica', 'Pedra Iônica', 'Pedras', 'variável', 'sim', 'Uma ação lança a pedra para orbitar a cabeça a 30 cm e conceder seu benefício; outra criatura pode removê-la com ataque contra CA 24 ou teste de Destreza (Acrobacia) CD 24. Pode ser guardada com uma ação. Tem CA 24, 10 PV e resistência a todos os danos. Variantes: Absorção (muito rara; reação cancela magia de até 4º nível direcionada ao usuário; perde a magia após absorver 20 níveis); Agilidade (muito rara; Destreza +2, máximo 20); Prontidão (rara; não pode ser surpreendido); Fortitude (muito rara; Constituição +2, máximo 20); Grande Absorção (lendária; como Absorção, até magia de 8º nível e 50 níveis absorvidos); Intuição (muito rara; Sabedoria +2); Intelecto (muito rara; Inteligência +2); Liderança (muito rara; Carisma +2); Maestria (lendária; bônus de proficiência +1); Proteção (rara; CA +1); Regeneração (lendária; recupera 15 PV ao fim de cada hora se tiver ao menos 1 PV); Armazenamento (rara; armazena até 3 níveis de magia e pode conter 1d4−1 níveis); Força (muito rara; Força +2); Sustento (rara; não precisa comer ou beber). Aumentos de atributo têm máximo 20.'),
  ('pedras-de-mensagem', 'Pedras de Mensagem', 'Pedras', 'incomum', NULL, 'Par de pedras. Ao tocar uma delas, uma ação conjura enviar mensagem para quem estiver portando a outra; se ninguém a portar, a magia não é conjurada. Recarregam ao amanhecer. Se uma for destruída, a outra se torna não mágica.'),
  ('penas-de-quaal', 'Penas de Quaal', 'Itens maravilhosos', 'raro', NULL, 'Pena mágica consumível de uso único; a variante é escolhida pelo Mestre ou determinada aleatoriamente. Âncora (01–20): fixa embarcação por 24 horas. Pássaro (21–35): cria pássaro Enorme obediente, incapaz de atacar, para transporte. Leque (36–50): aumenta em 8 km/h por 8 horas o deslocamento de barco ou navio. Barco de Cisne (51–65): cria por 24 horas barco de 15 × 6 m, velocidade 10 km/h, capacidade para 32 criaturas Médias (Grandes contam como quatro, Enormes como nove). Árvore (66–90): cria carvalho não mágico de 18 m. Chicote (91–00): cria chicote flutuante por até 1 hora, ataque mágico +9 a até 3 m, dano de energia 1d6+5; voa 6 m antes de atacar novamente.'),
  ('pergaminho-de-magia', 'Pergaminho de Magia', 'Pergaminhos', 'variável', NULL, 'Contém uma magia. Se ela estiver na lista de classe do leitor, pode ser conjurada com uma ação e sem componentes. Se exceder o nível normalmente disponível, exige teste com habilidade de conjuração, CD 10 + nível da magia; em falha, a magia desaparece. Após conjurado, vira pó. Magia de mago pode ser copiada como de grimório com teste de Inteligência (Arcanismo), CD 10 + nível; o pergaminho é destruído em qualquer resultado. Raridade por nível: truque e 1º comum; 2º e 3º incomum; 4º e 5º raro; 6º a 8º muito raro; 9º lendário. CDs de resistência/ataque: truque e 1º 13/+5; 2º 13/+5; 3º e 4º 15/+7; 5º e 6º 17/+9; 7º e 8º 18/+10; 9º 19/+11.'),
  ('pergaminho-de-protecao', 'Pergaminho de Proteção', 'Pergaminhos', 'raro', NULL, 'Com uma ação, cria por 5 minutos uma barreira cilíndrica invisível de raio 1,5 m e altura 3 m que impede criaturas do tipo indicado de entrar ou afetar o interior. Acompanha o leitor; se ele se mover e permitir que uma dessas criaturas entre no cilindro, o efeito termina. Uma criatura pode tentar atravessar com uma ação e teste de Carisma CD 15. Tipo determinado por d100: aberrações 01–10, bestas 11–20, celestiais 21–30, elementais 31–40, fadas 41–50, corruptores 51–75, plantas 76–80, mortos-vivos 81–00.'),
  ('periapto-de-cicatrizacao', 'Periapto de Cicatrização', 'Periaptos', 'incomum', 'sim', 'Estabiliza automaticamente o usuário no início do turno quando está morrendo e dobra os PV recuperados ao gastar Dados de Vida.'),
  ('periapto-de-protecao-contra-veneno', 'Periapto de Proteção contra Veneno', 'Periaptos', 'raro', NULL, 'Enquanto usado, concede imunidade à condição envenenado e ao dano de veneno.'),
  ('periapto-de-sabedoria', 'Periapto de Sabedoria', 'Periaptos', 'raro', 'sim', 'Define Sabedoria como 19 enquanto usado; não tem efeito se o valor já for 19 ou maior.'),
  ('periapto-de-saude', 'Periapto de Saúde', 'Periaptos', 'incomum', NULL, 'Concede imunidade a doenças. Uma doença preexistente fica suprimida enquanto o pingente for usado.'),
  ('perola-do-poder', 'Pérola do Poder', 'Pérolas', 'incomum', 'conjurador', 'Com uma ação e a palavra de comando, recupera um espaço de magia gasto de até 3º nível. Recarrega no amanhecer seguinte.'),
  ('pigmentos-maravilhosos-de-nolzur', 'Pigmentos Maravilhosos de Nolzur', 'Itens maravilhosos', 'muito raro', NULL, 'Vêm em 1d4 potes com pincel e transformam imagens bidimensionais pintadas em objetos tridimensionais não mágicos. Cada pote cobre 300 m² e pode criar até 3.000 m³; pintar 30 m² leva 10 minutos. Uma criação não pode valer mais que 25 po; energia pintada desaparece sem causar dano.'),
  ('po-da-seca', 'Pó da Seca', 'Itens maravilhosos', 'incomum', NULL, 'Contém 1d6+4 punhados. Um punhado transforma um cubo de água de 4,5 m em uma esfera do tamanho de uma bola de gude; esmagá-la contra superfície dura restaura a água. Um elemental composto principalmente de água faz teste de Constituição CD 13 ou sofre 10d6 de dano necrótico (metade se passar).'),
  ('po-de-espirrar-e-tossir', 'Pó de Espirrar e Tossir', 'Itens maravilhosos', 'incomum', NULL, 'Pacote de uso único que aparenta ser pó do desaparecimento, inclusive para identificação. Ao ser lançado ao ar, criaturas que respiram a até 9 m fazem teste de Constituição CD 15 ou ficam incapacitadas e sufocando enquanto espirram; podem repetir o teste ao fim de cada turno. Restauração menor também encerra o efeito.'),
  ('po-do-desaparecimento', 'Pó do Desaparecimento', 'Itens maravilhosos', 'incomum', NULL, 'Pacote de uso único. Com uma ação, torna invisíveis por 2d4 minutos o usuário e criaturas e objetos a até 3 m. Atacar ou conjurar magia encerra a invisibilidade da criatura correspondente.'),
  ('pocao-de-amizade-animal', 'Poção de Amizade Animal', 'Poções', 'incomum', NULL, 'Por 1 hora após bebê-la, permite conjurar amizade animal à vontade (CD 13).'),
  ('pocao-de-aumentar', 'Poção de Aumentar', 'Poções', 'incomum', NULL, 'Concede o efeito aumentar de aumentar/reduzir por 1d4 horas, sem concentração.'),
  ('pocao-de-clarividencia', 'Poção de Clarividência', 'Poções', 'rara', NULL, 'Concede os benefícios da magia clarividência.'),
  ('pocao-de-cura-completa', 'Poção de Cura Completa', 'Poções', 'lendária', NULL, 'Recupera 70 PV e cura cegueira, surdez e qualquer doença que afete o usuário.'),
  ('pocao-de-encolher', 'Poção de Encolher', 'Poções', 'rara', NULL, 'Concede o efeito reduzir de aumentar/reduzir por 1d4 horas, sem concentração.'),
  ('pocao-de-envenenamento', 'Poção de Envenenamento', 'Poções', 'incomum', NULL, 'Veneno mágico disfarçado de poção benéfica; identificação revela sua natureza. Ao bebê-la, causa 3d6 de dano de veneno e exige teste de Constituição CD 13; em falha, o usuário fica envenenado e sofre 3d6 no início de cada turno. Sucessos repetidos ao fim do turno reduzem o dano subsequente em 1d6 até chegar a zero.'),
  ('pocao-de-escalar', 'Poção de Escalar', 'Poções', 'comum', NULL, 'Por 1 hora, concede deslocamento de escalada igual ao de caminhada e vantagem em testes de Força (Atletismo) para escalar.'),
  ('pocao-de-forma-gasosa', 'Poção de Forma Gasosa', 'Poções', 'rara', NULL, 'Concede forma gasosa por 1 hora, sem concentração, ou até o usuário encerrar o efeito com uma ação bônus.'),
  ('pocao-de-forca-do-gigante', 'Poção de Força do Gigante', 'Poções', 'variável', NULL, 'Por 1 hora, define Força pelo valor da variante e não produz efeito se o usuário já tiver valor igual ou maior. Gigante da colina: 21 (incomum); pedra ou gelo: 23 (rara); fogo: 25 (rara); nuvens: 27 (muito rara); tempestade: 29 (lendária).'),
  ('pocao-de-heroismo', 'Poção de Heroísmo', 'Poções', 'rara', NULL, 'Por 1 hora, concede 10 PV temporários e o efeito de benção, sem concentração.'),
  ('pocao-de-invisibilidade', 'Poção de Invisibilidade', 'Poções', 'muito raro', NULL, 'Torna o usuário e tudo que veste ou carrega invisíveis por 1 hora. O efeito termina se atacar ou conjurar magia.'),
  ('pocao-de-invulnerabilidade', 'Poção de Invulnerabilidade', 'Poções', 'rara', NULL, 'Concede resistência a todos os danos por 1 minuto.'),
  ('pocao-de-ler-mentes', 'Poção de Ler Mentes', 'Poções', 'rara', NULL, 'Concede os efeitos de detectar pensamentos (CD 13).'),
  ('pocao-de-longevidade', 'Poção de Longevidade', 'Poções', 'muito raro', NULL, 'Reduz a idade física em 1d6+6 anos, até o mínimo de 13. Cada uso posterior tem chance cumulativa de 10% de, em vez disso, envelhecer o usuário em 1d6+6 anos.'),
  ('pocao-de-resistencia', 'Poção de Resistência', 'Poções', 'incomum', NULL, 'Concede resistência a um tipo de dano por 1 hora: ácido, frio, fogo, energia, elétrico, necrótico, veneno, psíquico, radiante ou trovejante.'),
  ('pocao-de-respirar-na-agua', 'Poção de Respirar na Água', 'Poções', 'incomum', NULL, 'Permite respirar debaixo d’água por 1 hora.'),
  ('pocao-de-sopro-de-fogo', 'Poção de Sopro de Fogo', 'Poções', 'incomum', NULL, 'Por até 1 hora, permite usar uma ação bônus para exalar fogo contra alvo a até 9 m. O alvo faz teste de Destreza CD 13 ou sofre 4d6 de dano de fogo (metade se passar). Termina após três usos.'),
  ('pocao-de-velocidade', 'Poção de Velocidade', 'Poções', 'muito raro', NULL, 'Concede os efeitos de velocidade por 1 minuto, sem concentração.'),
  ('pocao-de-vitalidade', 'Poção de Vitalidade', 'Poções', 'muito raro', NULL, 'Remove toda exaustão e cura doenças e venenos. Durante 24 horas, cada Dado de Vida gasto recupera seu valor máximo.'),
  ('pocao-de-voo', 'Poção de Voo', 'Poções', 'muito raro', NULL, 'Por 1 hora, concede deslocamento de voo igual ao de caminhada e permite planar. Se o efeito terminar no ar, o usuário cai, salvo se dispuser de outro meio de sustentação.'),
  ('poco-dos-muitos-mundos', 'Poço dos Muitos Mundos', 'Itens maravilhosos', 'lendário', NULL, 'Tecido que se abre em círculo de 1,8 m. Colocado sobre superfície sólida com uma ação, cria portal de via dupla para outro mundo ou plano escolhido pelo Mestre. Pode ser dobrado com uma ação para fechar o portal. Após abrir, só pode fazê-lo novamente depois de 1d8 horas.'),
  ('oculos-noturnos', 'Óculos Noturnos', 'Itens maravilhosos', 'incomum', NULL, 'Concede visão no escuro com alcance de 18 m; se o usuário já a possuir, aumenta seu alcance em 18 m.'),
  ('olhos-de-aguia', 'Olhos de Águia', 'Itens maravilhosos', 'incomum', 'sim', 'Concede vantagem em testes de Sabedoria (Percepção) ligados à visão. Com visibilidade clara, permite distinguir detalhes de criaturas e objetos muito distantes com até 60 cm.'),
  ('olhos-de-visao-momentanea', 'Olhos de Visão Momentânea', 'Itens maravilhosos', 'incomum', NULL, 'Permite enxergar com muito mais clareza a até 30 cm e concede vantagem em testes visuais de Inteligência (Investigação) para procurar em uma área ou estudar um objeto nesse alcance.'),
  ('olhos-do-encantamento', 'Olhos do Encantamento', 'Itens maravilhosos', 'incomum', 'sim', 'Possui 3 cargas. Com uma ação e 1 carga, conjura enfeitiçar pessoa (CD 13) sobre humanoide a até 9 m, desde que usuário e alvo possam se ver. Recupera todas as cargas ao amanhecer.'),
  ('robe-das-cores-cintilantes', 'Robe das Cores Cintilantes', 'Robes', 'muito raro', 'sim', 'Possui 3 cargas e recupera 1d3 ao amanhecer. Uma ação e 1 carga criam padrão ofuscante até o fim do turno seguinte, com luz plena a 9 m e penumbra por mais 9 m. Criaturas que vejam o usuário têm desvantagem nos ataques contra ele; criaturas na luz plena fazem teste de Sabedoria CD 15 ou ficam atordoadas até o efeito terminar.'),
  ('robe-das-estrelas', 'Robe das Estrelas', 'Robes', 'muito raro', 'sim', 'Concede +1 em testes de resistência. Tem seis estrelas grandes; uma ação remove uma para conjurar mísseis mágicos como magia de 5º nível. Ao escurecer, 1d6 estrelas reaparecem. Uma ação transporta o usuário e equipamento ao Plano Astral; outra ação permite retornar ao último espaço ocupado ou ao desocupado mais próximo.'),
  ('robe-do-arquimago', 'Robe do Arquimago', 'Robes', 'lendário', 'bruxo, feiticeiro ou mago', 'Robe branca, cinza ou preta, criada para uma tendência: branca para boa, cinza para neutra e preta para má, adornada com runas prateadas. A descrição do documento está interrompida após “Você não pode se”; os efeitos e a restrição restantes não foram informados.')
) AS items(id, name, subcategory, rarity, attunement, description)
ON CONFLICT (id) DO NOTHING;

COMMIT;
