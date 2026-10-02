# Zap Balcão · NicoShake Labs

Robô de atendimento para WhatsApp, controlado por planilha Google.
Foco inicial: **assistência técnica** (consulta de OS, orçamento, garantia, atendente humano).

## Arquivos
- `index.html`: editor + simulador (abre no navegador, sem instalar nada)
- `ZapBalcao.gs`: adaptador modo econômico (Apps Script + AutoResponder for WA)

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

## Roadmap
- [ ] Piloto real (assistência técnica)
- [ ] Botão "Gerar Apps Script" no editor
- [ ] Aviso automático de "ficou pronto" (modo API)
- [ ] Relatório mensal de atendimentos
