@echo off
title Servidor Node.js + MySQL (INSTITUICAO)
cd /d "C:\projetos\Agenda_TCC"

:: 1. Mata processos antigos
taskkill /f /im node.exe >nul 2>&1


:: 5. Mostra logs
type logs\server.log