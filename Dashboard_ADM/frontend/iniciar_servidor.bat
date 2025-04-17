@echo off
title Servidor Node.js + MySQL (INSTITUICAO)
cd /d "C:\projetos\Agenda_TCC\Dashboard_ADM\frontend"

:: 1. Mata processos antigos
taskkill /f /im node.exe >nul 2>&1

:: 2. Inicia o servidor
start "Servidor" node server.js

:: 3. Espera 10 segundos
timeout /t 10 /nobreak >nul

:: 4. Abre no Opera GX
start "" "http://localhost:5500/index.html"

:: 5. Mostra logs
type logs\server.log


