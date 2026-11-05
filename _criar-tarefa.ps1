# =============================================================================
# _criar-tarefa.ps1                                                   v1.2.0
# Autor: Ruda Gabriel
# -----------------------------------------------------------------------------
# Auxiliar do instalar-na-inicializacao.bat (nao precisa ser executado direto).
# Cria (ou recria) a tarefa agendada que inicia o relatorio, com a
# configuracao completa - o "schtasks /create" nao consegue definir metade
# destas opcoes:
#
#   Disparadores:  "Ao fazer logon" de QUALQUER usuario  +  "Ao inicializar"
#   Condicoes:     todas desmarcadas (sem ocioso, sem exigir energia AC, sem
#                  reativar o computador, sem exigir rede)
#   Configuracoes: executar por demanda; executar o mais cedo possivel se uma
#                  inicializacao agendada foi perdida; se falhar, reiniciar a
#                  cada 1 minuto ate 99 vezes; SEM limite de tempo de execucao;
#                  forcar a interrupcao se nao parar quando solicitado; nunca
#                  excluir; se ja estiver rodando, nao iniciar outra instancia.
#
# Roda como o usuario que instalou, "somente quando conectado" (Interactive):
# o icone da bandeja precisa da area de trabalho. Por isso o disparador "Ao
# inicializar" so' consegue abrir o tray quando ja ha sessao (logon automatico);
# sem sessao, o disparador "Ao fazer logon" cobre assim que alguem entrar. Os
# dois disparando juntos nao duplicam nada: "nao iniciar outra instancia" na
# tarefa e o mutex do proprio tray garantem uma unica copia.
#
# Acao da tarefa (v1.1.0): o proprio PowerShell, oculto, espera ate 30 min o
# launcher.vbs aparecer (pasta de rede ainda nao montada no logon) e o abre.
# Nao existe mais bootstrap.vbs: nenhum script fica copiado no AppData nem
# vai no .zip, e o antivirus nao tem o que acusar. O comando termina com o
# marcador "#RelatoriosAguardaRede", usado pelo removedor para reconhecer a
# espera em andamento.
#
# Sem janela nenhuma (v1.2.0): "powershell -WindowStyle Hidden" ainda pisca
# uma janela preta, porque o console nasce antes de ser escondido. Por isso:
#   - pasta LOCAL (disco fixo): a tarefa abre direto "wscript.exe launcher.vbs"
#     - nada aparece e nao ha o que esperar (disco local sempre esta pronto);
#   - pasta de REDE (\\servidor\... ou unidade mapeada) ou desconhecida: a
#     espera acima roda dentro de "conhost.exe --headless" (console sem
#     janela, Windows 10 1809 ou mais novo); em Windows mais antigo, o
#     PowerShell oculto como antes.
#
# Codigo de saida: 0 = criada e conferida, 1 = falhou (o .bat cai no schtasks).
#
# (Historico completo das versoes: CHANGELOG.md no repositorio.)
# CHANGELOG 1.2.0 - 2026-11-05 - Inicializacao 100% silenciosa.
#   - Pasta local: a tarefa abre o launcher.vbs direto pelo wscript (sem
#     PowerShell, sem janela). Pasta de rede: a espera roda em
#     "conhost.exe --headless", sem a janela preta piscando.
# =============================================================================

param(
    [Parameter(Mandatory = $true)][string]$Nome,
    [Parameter(Mandatory = $true)][string]$Launcher,
    [string]$Usuario = ''
)

$ErrorActionPreference = 'Stop'

try {
    if (-not (Get-Command Register-ScheduledTask -ErrorAction SilentlyContinue)) {
        throw 'modulo ScheduledTasks indisponivel neste Windows'
    }
    $Launcher = $Launcher.Trim()
    # Caminho absoluto (C:\... ou \\servidor\...): a tarefa roda em
    # System32, um caminho relativo nunca seria achado.
    if (-not $Launcher -or -not [System.IO.Path]::IsPathRooted($Launcher)) { throw "caminho do launcher invalido: '$Launcher'" }
    # Nao precisa existir agora (pasta de rede pode nao estar montada); so' avisa.
    if (-not (Test-Path -LiteralPath $Launcher)) { Write-Output "  [AVISO] launcher.vbs ainda nao encontrado em $Launcher - a tarefa espera ate 30 min por ele no logon." }
    # "%" seria expandido pelo Agendador como variavel de ambiente.
    if ($Launcher.Contains('%')) { throw "o caminho do launcher nao pode conter '%': $Launcher" }
    if (-not $Usuario) {
        $Usuario = if ($env:USERDOMAIN) { "$env:USERDOMAIN\$env:USERNAME" } else { $env:USERNAME }
    }

    # Comando sem aspas duplas internas (vai inteiro entre aspas duplas) e
    # com o caminho entre aspas simples (apostrofo dobrado). "& wscript.exe"
    # nao espera: o wscript e' programa de janela, o PowerShell sai em seguida.
    $caminhoPs = $Launcher.Replace("'", "''")
    $espera = "`$p='" + $caminhoPs + "';for(`$i=0;`$i -lt 120;`$i++){if(Test-Path -LiteralPath `$p){& wscript.exe `$p;exit 0};Start-Sleep -Seconds 15};exit 5 #RelatoriosAguardaRede"
    $argumentos = '-NoProfile -NonInteractive -WindowStyle Hidden -Command "' + $espera + '"'

    # Pasta local? So' disco FIXO conta como local. UNC, unidade mapeada,
    # removivel ou unidade que esta instancia (elevada) nem enxerga caem na
    # espera - o lado seguro.
    $local = $false
    try {
        if (-not $Launcher.StartsWith('\\')) {
            $raiz = [System.IO.Path]::GetPathRoot($Launcher)
            if ($raiz) { $local = ((New-Object System.IO.DriveInfo($raiz)).DriveType -eq [System.IO.DriveType]::Fixed) }
        }
    } catch { $local = $false }

    # conhost --headless: console sem janela (Windows 10 1809 = build 17763+).
    $conhost = Join-Path $env:SystemRoot 'System32\conhost.exe'
    $temHeadless = $false
    try { $temHeadless = ([Environment]::OSVersion.Version.Build -ge 17763) -and (Test-Path -LiteralPath $conhost) } catch { $temHeadless = $false }

    if ($local -and (Test-Path -LiteralPath $Launcher)) {
        # //B: nenhuma mensagem do Windows Script Host aparece, nem se a pasta
        # for apagada/movida depois da instalacao.
        $acao = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument ('//B //Nologo "' + $Launcher + '"')
        $modo = 'pasta local: wscript direto, sem janela'
    } elseif ($temHeadless) {
        $acao = New-ScheduledTaskAction -Execute $conhost -Argument ('--headless powershell.exe ' + $argumentos)
        $modo = 'pasta de rede: espera em segundo plano (conhost --headless), sem janela'
    } else {
        $acao = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argumentos
        $modo = 'pasta de rede: espera em segundo plano (Windows antigo: pode piscar uma janela no logon)'
    }

    # -AtLogOn sem -User = "Quando qualquer usuario fizer logon".
    $gatilhos = @(
        (New-ScheduledTaskTrigger -AtLogOn),
        (New-ScheduledTaskTrigger -AtStartup)
    )

    $principal = New-ScheduledTaskPrincipal -UserId $Usuario -LogonType Interactive -RunLevel Limited

    # Padroes que ja atendem e por isso nao aparecem aqui: executar por demanda
    # (AllowDemandStart), forcar interrupcao (AllowHardTerminate), sem
    # condicao de ocioso, sem reativar o computador, sem exigir rede, sem
    # exclusao automatica.
    $cfg = New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -StartWhenAvailable `
        -RestartCount 99 `
        -RestartInterval (New-TimeSpan -Minutes 1) `
        -ExecutionTimeLimit ([TimeSpan]::Zero) `
        -MultipleInstances IgnoreNew

    $tarefa = New-ScheduledTask -Action $acao -Trigger $gatilhos -Principal $principal -Settings $cfg `
        -Description 'Inicia o servidor de relatorios (icone na bandeja) no logon e ao ligar o computador. Criada por instalar-na-inicializacao.bat.'

    Register-ScheduledTask -TaskName $Nome -InputObject $tarefa -Force | Out-Null

    # Confere o que ficou gravado (nao confia so' no retorno do Register).
    $t = Get-ScheduledTask -TaskName $Nome
    $tipos = @($t.Triggers | ForEach-Object { $_.CimClass.CimClassName })
    if (-not ($tipos -contains 'MSFT_TaskLogonTrigger') -or -not ($tipos -contains 'MSFT_TaskBootTrigger')) {
        throw "disparadores gravados incompletos: $($tipos -join ', ')"
    }
    $s = $t.Settings
    if ($s.DisallowStartIfOnBatteries -or $s.RestartCount -ne 99 -or $s.ExecutionTimeLimit -ne 'PT0S') {
        throw 'configuracoes gravadas diferentes do esperado'
    }

    Write-Output "  [OK] Tarefa '$Nome': ao fazer logon (qualquer usuario) e ao inicializar;"
    Write-Output '       sem condicoes; reinicia a cada 1 min (ate 99x); sem limite de tempo.'
    Write-Output "       Acao: $modo."
    exit 0
} catch {
    Write-Output "  [AVISO] Configuracao completa da tarefa falhou: $($_.Exception.Message)"
    exit 1
}
