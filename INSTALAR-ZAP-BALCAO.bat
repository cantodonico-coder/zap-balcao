@echo off
chcp 65001 >nul
setlocal
title Zap Balcão - Assistente de instalação
cd /d "%~dp0"
color 0F

if not exist "ZapBalcao.gs" (
  echo.
  echo  [ERRO] O arquivo ZapBalcao.gs precisa estar nesta mesma pasta.
  pause
  exit /b
)

:INICIO
cls
echo.
echo  ==========================================================
echo     ZAP BALCÃO  -  Seu WhatsApp respondendo sozinho
echo     Assistente de instalação  ·  NicoShake Labs
echo  ==========================================================
echo.
echo   Você vai precisar de:
echo     - Este computador
echo     - Um celular Android com o número que vai atender
echo     - Uma conta Google (Gmail)
echo.
echo   Tempo: uns 20 minutos. São 6 passos, um de cada vez.
echo.
echo   [Enter] Começar do passo 1
echo   [2-6]   Pular para um passo (se parou no meio)
echo.
set "op="
set /p op=  Escolha: 
if "%op%"=="2" goto P2
if "%op%"=="3" goto P3
if "%op%"=="4" goto P4
if "%op%"=="5" goto P5
if "%op%"=="6" goto P6

:P1
cls
echo.
echo  PASSO 1 de 6  -  MONTAR AS RESPOSTAS DO SEU ROBÔ
echo  ----------------------------------------------------------
echo   Vai abrir o Zap Balcão no navegador.
echo.
echo   1. Em "00 Modelo", escolha o tipo do seu negócio
echo   2. Troque nome, endereço, horário e respostas
echo   3. Teste à vontade no celular desenhado ao lado
echo   4. Quando gostar: abra "06 Exportar" e clique COPIAR
echo.
echo   Deixe copiado. Vamos usar no próximo passo.
echo.
pause
if exist "index.html" (start "" "index.html") else (start "" "https://cantodonico-coder.github.io/zap-balcao/")
echo.
echo   Quando já tiver clicado em COPIAR, volte aqui.
pause

:P2
cls
echo.
echo  PASSO 2 de 6  -  CRIAR A PLANILHA DO ROBÔ
echo  ----------------------------------------------------------
echo   Vai abrir uma planilha nova do Google.
echo.
echo   1. Embaixo, clique duas vezes em "Página1" e renomeie para:  Config
echo   2. Clique na célula A1 e cole  (Ctrl + V)
echo   3. Clique no + embaixo e crie outra aba chamada:  Dados
echo   4. Em Dados, cole sua lista de OS/pedidos (opcional)
echo      A 1ª linha é o cabeçalho, igual ao do Zap Balcão.
echo   5. Dê um nome para a planilha, ex.: Robô WhatsApp
echo.
pause
start "" "https://sheets.new"
echo.
echo   Terminou? Volte aqui.
pause

:P3
cls
echo.
echo  PASSO 3 de 6  -  COLOCAR O CÉREBRO DO ROBÔ NA PLANILHA
echo  ----------------------------------------------------------
echo   Criando sua senha secreta...
for /f %%t in ('powershell -NoProfile -Command "[guid]::NewGuid().ToString('N').Substring(0,16)"') do set "TOKEN=%%t"
powershell -NoProfile -Command "(Get-Content -Raw -Encoding UTF8 'ZapBalcao.gs').Replace('TROQUE-ESTE-TOKEN','%TOKEN%') | Set-Content -Encoding UTF8 'ZapBalcao-pronto.gs'"
powershell -NoProfile -Command "Get-Content -Raw -Encoding UTF8 'ZapBalcao-pronto.gs' | Set-Clipboard"
> "minha-senha-do-robo.txt" echo %TOKEN%
echo   Pronto. O código já está COPIADO, com sua senha dentro.
echo.
echo   Na planilha:
echo   1. Menu  Extensões  ^>  Apps Script
echo   2. Apague tudo que aparecer lá e cole  (Ctrl + V)
echo   3. Clique no disquete para salvar
echo   4. Engrenagem à esquerda (Configurações do projeto):
echo      Fuso horário = (GMT-03:00) São Paulo
echo   5. Volte ao código, escolha a função  testar  e clique Executar
echo   6. O Google pede permissão: Revisar permissões ^> sua conta ^>
echo      Avançado ^> Acessar (não seguro) ^> Permitir
echo      É normal: o robô é seu e só mexe nesta planilha.
echo.
echo   Se o código sumiu da área de transferência, aperte C para copiar de novo.
:P3COPIA
set "op="
set /p op=  [C] Copiar de novo   [Enter] Já fiz, continuar: 
if /i "%op%"=="C" (
  powershell -NoProfile -Command "Get-Content -Raw -Encoding UTF8 'ZapBalcao-pronto.gs' | Set-Clipboard"
  echo   Copiado!
  goto P3COPIA
)

:P4
cls
if not defined TOKEN if exist "minha-senha-do-robo.txt" set /p TOKEN=<"minha-senha-do-robo.txt"
if not defined TOKEN (
  echo.
  echo   Falta a senha do robô. Volte ao passo 3.
  pause
  goto P3
)
echo.
echo  PASSO 4 de 6  -  LIGAR O ROBÔ NA INTERNET
echo  ----------------------------------------------------------
echo   No Apps Script:
echo   1. Botão azul  Implantar  ^>  Nova implantação
echo   2. Engrenagem ao lado de "Selecione o tipo"  ^>  App da Web
echo   3. Executar como:  Eu
echo      Quem pode acessar:  Qualquer pessoa
echo   4. Implantar  ^>  copie o "URL do app da Web"
echo      (termina com /exec)
echo.
:P4URL
set "URL="
set /p URL=  Cole aqui o URL e aperte Enter: 
if not defined URL goto P4URL
echo %URL% | findstr /i "script.google.com" | findstr /i "/exec" >nul
if errorlevel 1 (
  echo   Esse não parece o URL certo. Ele começa com https://script.google.com e termina com /exec
  goto P4URL
)
echo.
echo   Testando o robô...
powershell -NoProfile -Command "try{$r=Invoke-WebRequest -UseBasicParsing '%URL%'; if($r.Content -match 'OK'){exit 0}else{exit 1}}catch{exit 2}"
if errorlevel 1 (
  echo   [!] Não respondeu OK. Confira: Quem pode acessar = Qualquer pessoa.
  echo       Depois de mudar, faça uma nova implantação e cole o novo URL.
  goto P4URL
)
echo   Robô ligado! ✅
set "LINK=%URL%?k=%TOKEN%"
> "LINK-DO-ROBO.txt" echo %LINK%
powershell -NoProfile -Command "Set-Clipboard -Value '%LINK%'"
echo.
echo   O link do robô foi salvo em  LINK-DO-ROBO.txt  e está copiado.
echo   Mande ele para você mesmo (e-mail ou WhatsApp de outro número)
echo   para abrir no celular. Não compartilhe com ninguém: tem sua senha.
echo.
pause

:P5
cls
echo.
echo  PASSO 5 de 6  -  PREPARAR O CELULAR
echo  ----------------------------------------------------------
echo   Vão abrir 2 apps na Play Store. Instale no celular do robô
echo   (pelo PC dá para escolher o aparelho, se for a mesma conta Google).
echo.
echo   1. WhatsApp Business: cadastre o número que vai atender
echo   2. AutoResponder for WA: abra e aceite o acesso às notificações
echo.
pause
start "" "https://play.google.com/store/apps/details?id=com.whatsapp.w4b"
start "" "https://play.google.com/store/apps/details?id=tkstudio.autoresponderforwa"
echo.
echo   No AutoResponder, crie uma regra (botão +):
echo   - App: WhatsApp Business
echo   - Mensagem recebida: TODAS
echo   - Resposta: opção Web Server / servidor  ^>  cole o LINK DO ROBÔ
echo   - Grupos: desligado
echo   - Salve a regra
echo.
echo   Para o celular não desligar o robô:
echo   - Configurações ^> Bateria ^> AutoResponder e WhatsApp Business:
echo     "Sem restrições"
echo   - Notificações do WhatsApp Business: LIGADAS
echo   - Celular na tomada e com internet
echo.
pause

:P6
cls
echo.
echo  PASSO 6 de 6  -  TESTE FINAL
echo  ----------------------------------------------------------
echo   1. De OUTRO celular, mande  oi  para o número do robô
echo   2. A resposta chega em poucos segundos ✅
echo   3. Na planilha, a aba Log mostra a conversa
echo.
echo   Não respondeu?
echo   - Notificações do WhatsApp Business estão ligadas?
echo   - A regra do AutoResponder está ativa?
echo   - Não abra a conversa no celular do robô antes da resposta
echo   - A opção Web Server pode exigir a versão paga do AutoResponder
echo.
echo   No dia a dia: é só atualizar a aba Dados da planilha.
echo   O robô sempre responde com a informação mais nova.
echo.
echo  ==========================================================
echo     Pronto! Seu WhatsApp agora atende sozinho.  ·  Zap Balcão
echo  ==========================================================
echo.
pause
endlocal
