# Regras do projeto (para o assistente de código)

- **Idioma:** sempre pt-BR — respostas, código, comentários, mensagens de commit e PR.
- **Somente leitura no banco:** o projeto nunca escreve no Firebird. Só SELECT/WITH,
  transação `readOnly`. Nada de UPDATE/INSERT/DELETE, índices ou mudar o banco para
  read-only — a trava vale só para as conexões deste projeto, nunca para o PDV.
- **Código à prova de erros:** antes de entregar, procurar bugs e cenários de erro no
  próprio diff (entradas inválidas, rede caindo, Windows, celular) e corrigir.
- **Changelog:** o cabeçalho de cada arquivo traz só a entrada da versão atual (mais a
  linha "Histórico completo das versões: CHANGELOG.md no repositório."). O histórico
  completo fica no `CHANGELOG.md`: nova entrada no topo da seção do arquivo e tabela de
  versões atualizada. Toda mudança de código sobe a versão do arquivo.
- **README sempre atualizado:** toda mudança que o usuário perceba (recurso novo, tela,
  opção, rota, arquivo, dependência, versão, quantidade de testes) atualiza o `README.md`
  no mesmo PR — badges de versão/testes, badges de bibliotecas e tecnologias novas, a
  seção "Tecnologias e bibliotecas", "Uso no dia a dia", rotas da API e solução de
  problemas. Tudo explicado de forma clara para quem não é técnico.
- **Exemplos neutros:** placeholders, exemplos, testes e documentação sem nomes de
  pessoas, clientes, lojas ou marcas (ex.: "Celular do Caixa 1", VENDEDOR A, FULANO).
- **Projeto autônomo:** sem menções a outros projetos nem citações de terceiros; o
  sistema de origem é chamado de "PDV" (só o arquivo `SMALL.FDB` e as pastas de
  instalação ficam no código, porque são necessários para achar o banco). Os únicos
  créditos são do autor, Ruda Gabriel (README, `LICENSE`, `package.json`, cabeçalhos).
- **Informações sempre atuais:** a cada mudança, procurar e corrigir no projeto
  inteiro o que ficou desatualizado — README (badges, versões, contagem de testes,
  lista de arquivos, rotas da API, opções do `config.json`, solução de problemas),
  tabela e seções do `CHANGELOG.md` (todo arquivo versionado tem linha e seção),
  cabeçalhos de versão, `SCRIPT_VERSION`/`SERVER_VERSION`, comentários que citem
  arquivos, funções ou comportamentos que não existem mais, mensagens na tela e no
  log. Nada pode descrever o sistema como ele era antes.
- **Arquivos do Windows:** `iniciar-tray.ps1`, `api.ps1` e os `.vbs` ficam 100% ASCII
  (acentos no tray como `\uXXXX`, convertidos por `L()`); preservar BOM/CRLF onde existir.
- **Antes de entregar:** `npm test` verde; validar no navegador (Playwright) o que
  mudou na tela, no computador e no celular.
- **Pull requests:** depois de abrir o PR e com os testes verdes, **fazer o merge
  automaticamente** (pedido do dono do repositório) — não esperar aprovação manual.
