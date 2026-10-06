# Zap Balcão · NicoShake Labs

Robô de atendimento para WhatsApp, controlado por planilha Google.
Foco inicial: **assistência técnica** (consulta de OS, orçamento, garantia, atendente humano).

## Arquivos
- `index.html`: editor + simulador (abre no navegador, sem instalar nada)
- `ZapBalcao.gs`: adaptador modo econômico (Apps Script + AutoResponder for WA)
- `INSTALAR-ZAP-BALCAO.bat`: assistente de instalação em 6 passos (Windows)

## Modos
| Modo | Status |
|---|---|
| Simulador | ✅ pronto |
| Econômico (Android + AutoResponder) | 🟡 código pronto, falta teste real |
| Oficial (WhatsApp Cloud API) | ⏳ planejado |

## Como funciona
1. Monte o fluxo no editor (modelos: assistência, oficina, loja, salão)
2. Teste no simulador
3. Exporte o JSON → aba `Config` (A1) da planilha do cliente
4. Dados de consulta na aba `Dados`
5. Apps Script publicado como App da Web → URL no AutoResponder

Motor único, independente do canal: o mesmo fluxo roda no simulador, no Android e na API.
O bloco `Motor` é idêntico em `index.html` e `ZapBalcao.gs`: ao mudar um, copie para o outro.

## O que o robô entende
- Saudações do jeito que o cliente escreve ("oii", "boa tarde, tudo bem?")
- Consulta direta: "os 1042", "os1042", "o.s. 1042" ou só o número
- Perguntas que citam uma opção do menu ("qual o endereço?", "quero falar com atendente")
- Palavras-chave por palavra inteira (com plural)
- "obrigado", "valeu": responde a despedida · "ok", 👍: fica quieto
- Horário com fechamento diferente no sábado
- Colunas pessoais da planilha (cliente, telefone, cpf) ficam fora da resposta

## Roadmap
- [ ] Piloto real (assistência técnica)
- [ ] Botão "Gerar Apps Script" no editor
- [ ] Aviso automático de "ficou pronto" (modo API)
- [ ] Relatório mensal de atendimentos
