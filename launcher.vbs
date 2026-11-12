' =============================================================================
' launcher.vbs                                                       v1.0.2
' Autor: Ruda Gabriel
' -----------------------------------------------------------------------------
' Ponto de entrada de TODOS os fluxos que abrem o sistema:
'   - gerar_relatorio_do_dia.bat       (wscript.exe "%~dp0launcher.vbs")
'   - gerar_relatorio_por_data.bat     (wscript.exe "%~dp0launcher.vbs")
'   - gerar_relatorio_intervalo.bat    (wscript.exe "%~dp0launcher.vbs")
'   - tarefa agendada criada por instalar-na-inicializacao.bat /
'     _criar-tarefa.ps1 (abre este arquivo no logon; em pasta de rede, a
'     propria tarefa espera ate 30 min ele aparecer)
'
' Unica responsabilidade: lancar iniciar-tray.ps1 em segundo plano, TOTALMENTE
' oculto (sem flash de janela de console - o que "powershell -WindowStyle
' Hidden" sozinho, quando chamado diretamente de um .bat, nem sempre evita).
' Um .vbs executado via wscript.exe e' a forma padrao no Windows de garantir
' isso. Arquivo 100% ASCII (o wscript le .vbs sem BOM na code page do sistema).
'
' (Historico completo das versoes: CHANGELOG.md no repositorio.)
' CHANGELOG 1.0.2 - 2026-11-12 - Comentarios atualizados: sem bootstrap.vbs (a
'   tarefa agendada abre este arquivo direto). Nenhuma mudanca de codigo.
'

Option Explicit

Dim fso, sh, scriptDir, psPath, cmd

On Error Resume Next

Set fso = CreateObject("Scripting.FileSystemObject")
If Err.Number <> 0 Then WScript.Quit 1
Set sh = CreateObject("WScript.Shell")
If Err.Number <> 0 Then WScript.Quit 1
On Error Goto 0

' Pasta onde este proprio launcher.vbs esta salvo - iniciar-tray.ps1 deve
' estar ao lado dele (mesma pasta do projeto).
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
psPath    = fso.BuildPath(scriptDir, "iniciar-tray.ps1")

' Validacao defensiva: se iniciar-tray.ps1 nao existir (instalacao
' incompleta/corrompida), nao adianta tentar rodar - encerra silenciosamente
' com codigo de saida distinto para permitir diagnostico caso alguem rode
' "cscript launcher.vbs" manualmente para depurar.
If Not fso.FileExists(psPath) Then
    WScript.Quit 2
End If

' -WindowStyle Hidden: sem janela visivel.
' -NoProfile: inicializacao mais rapida, ignora profile.ps1 do usuario.
' -ExecutionPolicy Bypass: iniciar-tray.ps1 nao e' assinado digitalmente;
'   sem isso, a politica padrao do Windows (Restricted/AllSigned em muitas
'   instalacoes corporativas) bloquearia a execucao.
' -File: aspas duplas (Chr(34)) ao redor do caminho protegem contra espacos
'   no caminho (ex: "C:\Program Files\...", ou pasta com nome da loja).
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File " & _
      Chr(34) & psPath & Chr(34)

' Run(comando, janela, aguardarTermino):
'   janela=0        -> totalmente oculto
'   aguardarTermino=False -> dispara e nao espera (iniciar-tray.ps1 roda
'                            indefinidamente em segundo plano; esperar aqui
'                            travaria o launcher para sempre)
On Error Resume Next
sh.Run cmd, 0, False
If Err.Number <> 0 Then WScript.Quit 3
On Error Goto 0

WScript.Quit 0
