# Trama Sheet

Aplicação em React, TypeScript e Vite para criar e organizar fichas de personagem
de diferentes sistemas de RPG.

## Desenvolvimento local

Requisitos: Node.js 20.19+ ou 22.12+.

```sh
npm install
cp .env.example .env.local
npm run dev
```

Preencha `.env.local` com a Project URL e a publishable key do projeto Supabase
de desenvolvimento. O Vite carrega essas variáveis ao iniciar; reinicie o
servidor após alterá-las. A tela inicial oferece um teste simples da API REST.

As variáveis `VITE_*` são incluídas no código enviado ao navegador. Use aqui
somente a URL e a publishable key. **Nunca** coloque uma Supabase secret key,
senha do banco ou qualquer outra credencial privilegiada em uma variável `VITE_*`.

## Comandos

```sh
npm run dev      # servidor de desenvolvimento
npm run build    # verificação TypeScript e build de produção
npm run lint     # lint
npm run preview  # servir localmente o build
```
