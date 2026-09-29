export const cantripsByClass: Record<string, string[]> = {
  bardo: ['Amizade', 'Ataque Certeiro', 'Consertar', 'Globos de Luz', 'Ilusão Menor', 'Mãos Mágicas', 'Mensagem', 'Prestidigitação', 'Proteção contra Lâminas', 'Zombaria Viciosa'],
  bruxo: ['Amizade', 'Ataque Certeiro', 'Ilusão Menor', 'Mãos Mágicas', 'Prestidigitação', 'Proteção contra Lâminas', 'Rajada de Veneno', 'Rajada Mística', 'Toque Arrepiante'],
  clerigo: ['Chama Sagrada', 'Consertar', 'Estabilizar', 'Luz', 'Orientação', 'Prevenção Divina', 'Resistência', 'Taumaturgia'],
  druida: ['Bordão Místico', 'Chicote de Espinhos', 'Consertar', 'Criar Chamas', 'Druidismo', 'Orientação', 'Rajada de Veneno', 'Resistência'],
  feiticeiro: ['Amizade', 'Ataque Certeiro', 'Consertar', 'Espirro Ácido', 'Globos de Luz', 'Ilusão Menor', 'Luz', 'Mãos Mágicas', 'Mensagem', 'Prestidigitação', 'Proteção contra Lâminas', 'Raio de Fogo', 'Raio de Gelo', 'Rajada de Veneno', 'Toque Arrepiante', 'Toque Chocante'],
  mago: ['Amizade', 'Ataque Certeiro', 'Consertar', 'Espirro Ácido', 'Globos de Luz', 'Ilusão Menor', 'Luz', 'Mãos Mágicas', 'Mensagem', 'Prestidigitação', 'Proteção contra Lâminas', 'Raio de Fogo', 'Raio de Gelo', 'Rajada de Veneno', 'Toque Arrepiante', 'Toque Chocante'],
}

export const spellcastingAbilityByClass: Record<string, string> = {
  bardo: 'Carisma', bruxo: 'Carisma', clerigo: 'Sabedoria', druida: 'Sabedoria', feiticeiro: 'Carisma', mago: 'Inteligência', paladino: 'Carisma', patrulheiro: 'Sabedoria',
}

const spellListLines: Record<string, string[]> = {
  bardo: [
    '1|Amizade Animal;Compreender Idiomas;Curar Ferimentos;Detectar Magia;Disfarçar-se;Escrita Ilusória;Falar com Animais;Fogo das Fadas;Heroísmo;Identificação;Imagem Silenciosa;Onda Trovejante;Queda Suave;Palavra Curativa;Passos Longos;Perdição;Riso Histérico de Tasha;Servo Invisível;Sono;Sussurros Dissonantes',
    '2|Acalmar Emoções;Aprimorar Habilidade;Arrombar;Boca Encantada;Cativar;Cegueira/Surdez;Coroa da Loucura;Esquentar Metal;Despedaçar;Força Fantasmagórica;Detectar Pensamentos;Imobilizar Pessoa;Invisibilidade;Localizar Animais ou Plantas;Localizar Objeto;Mensageiro Animal;Nuvem de Adagas;Restauração Menor;Silêncio;Sugestão;Ver o Invisível;Zona da Verdade',
    '3|Ampliar Plantas;Clarividência;Dificultar Detecção;Dissipar Magia;Enviar Mensagem;Falar com os Mortos;Falar com Plantas;Forjar Morte;Glifo de Vigilância;Idiomas;Imagem Maior;Medo;Névoa Fétida;Padrão Hipnótico;Pequena Cabana de Leomund;Rogar Maldição',
    '4|Confusão;Compulsão;Movimentação Livre;Invisibilidade Maior;Localizar Criatura;Metamorfose;Porta Dimensional;Terreno Alucinógeno',
    '5|Âncora Planar;Animar Objetos;Círculo de Teletransporte;Conhecimento Lendário;Despertar;Despistar;Dominar Pessoa;Imobilizar Monstro;Missão;Modificar Memória;Palavra Curativa em Massa;Restauração Maior;Reviver os Mortos;Similaridade;Sonho;Vidência',
    '6|Ataque Visual;Encontrar o Caminho;Dança Irresistível de Otto;Ilusão Programada;Proteger Fortaleza;Sugestão em Massa;Visão da Verdade',
    '7|Espada de Mordenkainen;Forma Etérea;Miragem;Mansão Magnífica de Mordenkainen;Prisão de Energia;Projetar Imagem;Regeneração;Ressurreição;Símbolo;Teletransporte',
    '8|Dominar Monstro;Enfraquecer Intelecto;Limpar a Mente;Loquacidade;Palavra de Poder Atordoar',
    '9|Palavra de Poder Curar;Palavra de Poder Matar;Metamorfose Verdadeira;Sexto Sentido',
  ],
  bruxo: [
    '1|Armadura de Agathys;Braços de Hadar;Bruxaria;Compreender Idiomas;Enfeitiçar Pessoa;Escrita Ilusória;Proteção contra o Bem e Mal;Raio de Bruxa;Recuo Acelerado;Repreensão Infernal;Servo Invisível',
    '2|Cativar;Coroa da Loucura;Despedaçar;Escuridão;Imobilizar Pessoa;Invisibilidade;Nuvem de Adagas;Passo Nebuloso;Patas de Aranha;Raio do Enfraquecimento;Reflexos;Sugestão',
    '3|Círculo Mágico;Contramágica;Dissipar Magia;Fome de Hadar;Forma Gasosa;Idiomas;Imagem Maior;Remover Maldição;Medo;Padrão Hipnótico;Toque Vampírico;Voo',
    '4|Banimento;Porta Dimensional;Malogro;Terreno Alucinógeno',
    '5|Contato Extraplanar;Imobilizar Monstro;Sonho;Vidência',
    '6|Ataque Visual;Círculo da Morte;Conjurar Fada;Criar Mortos-Vivos;Carne para Pedra;Portal Arcano;Sugestão em Massa;Visão da Verdade',
    '7|Dedo da Morte;Forma Etérea;Prisão de Energia;Viagem Planar',
    '8|Dominar Monstro;Enfraquecer o Intelecto;Loquacidade;Palavra de Poder Atordoar;Semipleno',
    '9|Aprisionamento;Metamorfose Verdadeira;Palavra de Poder Matar;Projeção Astral;Sexto Sentido',
  ],
  clerigo: [
    '1|Bênção;Comando;Criar ou Destruir Água;Curar Ferimentos;Detectar Magia;Detectar o Bem e Mal;Detectar Veneno e Doença;Escudo da Fé;Infringir Ferimentos;Palavra Curativa;Perdição;Proteção contra o Bem e Mal;Purificar Alimentos;Raio Guiador;Santuário',
    '2|Acalmar Emoções;Ajuda;Aprimorar Habilidade;Arma Espiritual;Augúrio;Cegueira/Surdez;Chama Contínua;Encontrar Armadilhas;Imobilizar Pessoa;Localizar Objeto;Oração Curativa;Proteção contra Veneno;Repouso Tranquilo;Restauração Menor;Silêncio;Vínculo Protetor;Zona da Verdade',
    '3|Andar na Água;Animar Mortos;Círculo Mágico;Clarividência;Criar Alimentos;Dissipar Magia;Enviar Mensagem;Falar com os Mortos;Forjar Morte;Guardiões Espirituais;Glifo de Vigilância;Idiomas;Luz do Dia;Mesclar-se às Rochas;Palavra Curativa em Massa;Proteção contra Energia;Rogar Maldição;Sinal de Esperança;Remover Maldição;Revivificar',
    '4|Adivinhação;Banimento;Controlar a Água;Localizar Criatura;Guardião da Fé;Moldar Rochas;Movimentação Livre;Proteção contra a Morte',
    '5|Âncora Planar;Coluna de Chamas;Comunhão;Conhecimento Lendário;Consagrar;Curar Ferimentos em Massa;Dissipar o Bem e Mal;Missão;Praga;Praga de Insetos;Restauração Maior;Reviver os Mortos;Vidência',
    '6|Aliado Planar;Barreira de Lâminas;Criar Mortos-Vivos;Cura Completa;Encontrar o Caminho;Doença Plena;Banquete dos Heróis;Palavra de Recordação;Proibição;Visão da Verdade',
    '7|Conjurar Celestial;Forma Etérea;Palavra Divina;Regeneração;Ressurreição;Símbolo;Tempestade de Fogo;Viagem Planar',
    '8|Aura Sagrada;Campo Antimagia;Controlar o Clima;Terremoto',
    '9|Cura Completa em Massa;Portal;Projeção Astral;Ressurreição Verdadeira',
  ],
  druida: [
    '1|Amizade Animal;Bom Fruto;Constrição;Criar ou Destruir Água;Curar Ferimentos;Detectar Veneno e Doença;Enfeitiçar Pessoa;Falar com Animais;Fogo das Fadas;Névoa Obscurecente;Onda Trovejante;Palavra Curativa;Passos Longos;Purificar Alimentos;Salto',
    '2|Aprimorar Habilidade;Crescer Espinhos;Encontrar Armadilhas;Esfera Flamejante;Esquentar Metal;Imobilizar Pessoa;Lâmina Flamejante;Localizar Animais ou Plantas;Localizar Objeto;Lufada de Vento;Mensageiro Animal;Passos sem Pegadas;Pele de Árvore;Proteção contra Veneno;Raio Lunar;Restauração Menor;Sentido Bestial;Visão no Escuro',
    '3|Ampliar Plantas;Andar na Água;Conjurar Animais;Convocar Relâmpagos;Dissipar Magia;Falar com Plantas;Forjar Morte;Luz do Dia;Mesclar-se às Rochas;Muralha de Vento;Nevasca;Proteção contra Energia',
    '4|Confusão;Conjurar Elementais Menores;Conjurar Seres da Floresta;Controlar a Água;Dominar Besta;Inseto Gigante;Localizar Criatura;Malogro;Metamorfose;Moldar Rochas;Movimentação Livre;Muralha de Fogo;Pele de Pedra;Tempestade de Gelo;Terreno Alucinógeno;Vinha Esmagadora',
    '5|Âncora Planar;Caminhar em Árvores;Conjurar Elemental;Comunhão com a Natureza;Cúpula Antivida;Curar Ferimentos em Massa;Despertar;Missão;Muralha de Pedra;Praga;Praga de Insetos;Reencarnação;Restauração Maior;Vidência',
    '6|Banquete de Heróis;Caminhar no Vento;Conjurar Fada;Cura Completa;Encontrar o Caminho;Mover Terra;Muralha de Espinhos;Raio Solar;Teletransporte por Árvores',
    '7|Inverter a Gravidade;Miragem;Regeneração;Tempestade de Fogo;Viagem Planar',
    '8|Antipatia/Simpatia;Controlar o Clima;Enfraquecer o Intelecto;Explosão Solar;Formas Animais;Terremoto;Tsunami',
    '9|Alterar Forma;Ressurreição Verdadeira;Sexto Sentido;Tempestade da Vingança',
  ],
  feiticeiro: [
    '1|Armadura Arcana;Compreender Idiomas;Detectar Magia;Disfarçar-se;Enfeitiçar Pessoa;Escudo Arcano;Imagem Silenciosa;Leque Cromático;Mãos Flamejantes;Mísseis Mágicos;Névoa Obscurecente;Onda Trovejante;Orbe Cromática;Queda Suave;Raio de Bruxa;Recuo Acelerado;Sono;Salto;Vida Falsa',
    '2|Alterar-se;Aprimorar Habilidade;Arrombar;Aumentar/Reduzir;Cegueira/Surdez;Coroa da Loucura;Despedaçar;Detectar Pensamentos;Escuridão;Força Fantasmagórica;Imobilizar Pessoa;Invisibilidade;Levitação;Lufada de Vento;Nublar;Nuvem de Adagas;Passo Nebuloso;Patas de Aranha;Raio Ardente;Reflexos;Sugestão;Teia;Visão no Escuro;Ver o Invisível',
    '3|Andar na Água;Bola de Fogo;Clarividência;Contramágica;Dissipar Magia;Forma Gasosa;Idiomas;Imagem Maior;Lentidão;Luz do Dia;Medo;Nevasca;Névoa Fétida;Padrão Hipnótico;Piscar;Proteção contra Energia;Relâmpago;Respirar na Água;Velocidade;Voo',
    '4|Banimento;Confusão;Dominar Besta;Invisibilidade Maior;Malogro;Metamorfose;Muralha de Fogo;Pele de Pedra;Porta Dimensional;Tempestade de Gelo',
    '5|Animar Objetos;Círculo de Teletransporte;Cone de Frio;Criação;Dominar Pessoa;Enviar Mensagem;Imobilizar Monstro;Muralha de Pedra;Névoa Mortal;Praga de Insetos;Telecinésia',
    '6|Círculo da Morte;Corrente de Relâmpagos;Desintegrar;Globo de Invulnerabilidade;Mover Terra;Portal Arcano;Raio Solar;Sugestão em Massa;Visão da Verdade',
    '7|Bola de Fogo Controlável;Dedo da Morte;Forma Etérea;Inverter a Gravidade;Rajada Prismática;Teletransporte;Tempestade de Fogo;Viagem Planar',
    '8|Dominar Monstro;Explosão Solar;Nuvem Incendiária;Palavra de Poder Atordoar;Terremoto',
    '9|Chuva de Meteoros;Desejo;Palavra de Poder Matar;Parar o Tempo;Portal',
  ],
  mago: [
    '1|Alarme;Área Escorregadia;Armadura Arcana;Compreender Idiomas;Convocar Familiar;Detectar Magia;Disco Flutuante de Tenser;Disfarçar-se;Enfeitiçar Pessoa;Escrita Ilusória;Escudo Arcano;Identificação;Imagem Silenciosa;Leque Cromático;Mãos Flamejantes;Mísseis Mágicos;Névoa Obscurecente;Onda Trovejante;Orbe Cromática;Passos Longos;Proteção contra o Bem e Mal;Queda Suave;Raio Adoecente;Raio de Bruxa;Recuo Acelerado;Riso Histérico de Tasha;Salto;Servo Invisível;Sono;Vida Falsa',
    '2|Alterar-se;Arma Mágica;Arrombar;Aumentar/Reduzir;Aura Mágica de Nystul;Boca Encantada;Cegueira/Surdez;Chama Contínua;Coroa da Loucura;Despedaçar;Detectar Pensamentos;Escuridão;Esfera Flamejante;Flecha Ácida de Melf;Força Fantasmagórica;Imobilizar Pessoa;Invisibilidade;Levitação;Localizar Objeto;Lufada de Vento;Nublar;Nuvem de Adagas;Passo Nebuloso;Patas de Aranha;Raio Ardente;Raio do Enfraquecimento;Reflexos;Repouso Tranquilo;Sugestão;Teia;Tranca Arcana;Truque de Corda;Ver o Invisível;Visão no Escuro',
    '3|Animar Mortos;Bola de Fogo;Círculo Mágico;Clarividência;Contramágica;Dificultar Detecção;Dissipar Magia;Enviar Mensagem;Forjar Morte;Forma Gasosa;Glifo de Vigilância;Idiomas;Imagem Maior;Lentidão;Medo;Montaria Fantasmagórica;Nevasca;Névoa Fétida;Padrão Hipnótico;Pequena Cabana de Leomund;Piscar;Proteção contra Energia;Relâmpago;Remover Maldição;Respirar na Água;Rogar Maldição;Toque Vampírico;Velocidade;Voo',
    '4|Arca Secreta de Leomund;Assassino Fantasmagórico;Banimento;Cão Fiel de Mordenkainen;Confusão;Conjurar Elementais Menores;Construir;Controlar a Água;Escudo de Fogo;Esfera Resiliente de Otiluke;Invisibilidade Maior;Localizar Criatura;Malogro;Metamorfose;Moldar Rochas;Muralha de Fogo;Olho Arcano;Pele de Pedra;Porta Dimensional;Santuário Particular de Mordenkainen;Tempestade de Gelo;Tentáculos Negros de Evard;Terreno Alucinógeno',
    '5|Âncora Planar;Animar Objetos;Círculo de Teletransporte;Cone de Frio;Conhecimento Lendário;Conjurar Elemental;Contato Extraplanar;Criação;Criar Passagem;Despistar;Dominar Criatura;Imobilizar Monstro;Ligação Telepática de Rary;Mão de Bigby;Missão;Modificar Memória;Muralha de Energia;Muralha de Pedra;Névoa Mortal;Similaridade;Sonho;Telecinésia;Vidência',
    '6|Ataque Visual;Carne para Pedra;Círculo da Morte;Contingência;Corrente de Relâmpagos;Criar Mortos-Vivos;Dança Irresistível de Otto;Desintegrar;Esfera Congelante de Otiluke;Globo de Invulnerabilidade;Ilusão Programada;Invocação Instantânea de Drawmij;Mover Terra;Muralha de Gelo;Portal Arcano;Proteger Fortaleza;Raio Solar;Recipiente Arcano;Sugestão em Massa;Visão da Verdade',
    '7|Bola de Fogo Controlável;Dedo da Morte;Espada de Mordenkainen;Inverter a Gravidade;Isolamento;Forma Etérea;Mansão Magnífica de Mordenkainen;Miragem;Prisão de Energia;Projetar Imagem;Rajada Prismática;Símbolo;Simulacro;Teletransporte;Viagem Planar',
    '8|Antipatia/Simpatia;Campo Antimagia;Clone;Controlar o Clima;Dominar Monstro;Enfraquecer o Intelecto;Explosão Solar;Labirinto;Limpar a Mente;Nuvem Incendiária;Palavra de Poder Atordoar;Semipleno;Telepatia',
    '9|Alterar Forma;Aprisionamento;Chuva de Meteoros;Desejo;Encarnação Fantasmagórica;Metamorfose Verdadeira;Muralha Prismática;Palavra de Poder Matar;Parar o Tempo;Portal;Projeção Astral;Sexto Sentido',
  ],
  paladino: [
    '1|Auxílio Divino;Bênção;Comando;Curar Ferimentos;Destruição Colérica;Destruição Lancinante;Destruição Trovejante;Detectar o Bem e Mal;Detectar Magia;Detectar Veneno e Doença;Duelo Compelido;Escudo da Fé;Heroísmo;Proteção contra o Bem e Mal;Purificar Alimentos',
    '2|Ajuda;Arma Mágica;Convocar Montaria;Localizar Objeto;Marca da Punição;Proteção contra Veneno;Restauração Menor;Zona da Verdade',
    '3|Arma Elemental;Aura de Vitalidade;Círculo Mágico;Criar Alimentos;Destruição Cegante;Dissipar Magia;Luz do Dia;Manto do Cruzado;Remover Maldição;Revivificar',
    '4|Aura de Pureza;Aura de Vida;Banimento;Destruição Estonteante;Localizar Criatura;Proteção contra a Morte',
    '5|Círculo de Poder;Destruição Banidora;Dissipar o Bem e Mal;Missão;Onda Destrutiva;Reviver os Mortos',
  ],
  patrulheiro: [
    '1|Alarme;Amizade Animal;Bom Fruto;Curar Ferimentos;Detectar Magia;Detectar Veneno e Doença;Falar com Animais;Golpe Constritor;Marca do Caçador;Névoa Obscurecente;Passos Longos;Salto;Saraivada de Espinhos',
    '2|Cordão de Flechas;Crescer Espinhos;Encontrar Armadilhas;Localizar Animais ou Plantas;Localizar Objeto;Mensageiro Animal;Passos sem Pegadas;Pele de Árvore;Proteção contra Veneno;Restauração Menor;Sentido Bestial;Silêncio;Visão no Escuro',
    '3|Ampliar Plantas;Andar na Água;Conjurar Animais;Conjurar Rajada;Dificultar Detecção;Flecha Relampejante;Luz do Dia;Muralha de Vento;Proteção contra Energia;Respirar na Água',
    '4|Conjurar Seres da Floresta;Localizar Criatura;Movimentação Livre;Pele de Pedra;Vinha Esmagadora',
    '5|Aljava Veloz;Caminhar em Árvores;Comunhão com a Natureza;Conjurar Saraivada',
  ],
}

export const leveledSpellsByClass: Record<string, Record<number, string[]>> = Object.fromEntries(
  Object.entries(spellListLines).map(([className, lines]) => [className, Object.fromEntries(lines.map((line) => {
    const [level, spellNames] = line.split('|')
    return [Number(level), spellNames.split(';')]
  }))]),
)
