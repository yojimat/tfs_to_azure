 	
<#
.Description
Script para migração de um projeto git no tfs antigo para o novo Azure DevOps
#> 
param(
    [String]$NomeRepositorio,
    [String]$UuiddProjeto,
    [String]$NomeProjeto,
    [String]$GitUrl,
    [String]$BaseAzureUrl,
    [String]$TokenAzure,
    [switch]$Help,
    [switch]$PularCriacaoRepositorio
)

if ($Help) {
    Write-Host "Exemplo: "
    Write-Host ".\InicializaçãoProjetoExistente.ps1 -UuiddProjeto 5e9cd1a2-79e6-41f5-a482-26ea326c769b -NomeRepositorio 'Nome_Repositorio' -NomeProjeto 'Nome_Projeto' -BaseAzureUrl 'Azure_Url' -GitUrl URL_GIT -TokenAzure 'Token_Azure' [-PularCriacaoRepositorio] [-Help]"
}
else {
    if ($PularCriacaoRepositorio -eq $false) {
        $headers = New-Object "System.Collections.Generic.Dictionary[[String],[String]]"
        $headers.Add("Authorization", "Basic $($TokenAzure)")
        $headers.Add("Content-Type", "application/json")

        $body = "{
`n    `"name`": `"$($NomeRepositorio)`",
`n    `"project`": {
`n        `"id`": `"$($UuiddProjeto)`"
`n    }
`n}"

        Invoke-RestMethod "$($BaseAzureUrl)/$($NomeProjeto)/_apis/git/repositories?api-version=6.0" -Method 'POST' -Headers $headers -Body $body
    }
    if ($?) {    
        Write-Host "Clonando repositório..."
        Set-Location .\repos
        git clone $GitUrl -q | Out-Null
        Set-Location $NomeRepositorio
        git remote rm origin 
        git remote add origin $BaseAzureUrl/$NomeProjeto/_git/$NomeRepositorio
        git push -u origin --all -q | Out-Null
        Set-Location ..
        Remove-Item -Force -Recurse ".\\$($NomeRepositorio)\\"
        Set-Location ..
        Write-Host "Projeto '$($NomeRepositorio)' migrado com sucesso!"
        Exit 0
    }
    else {
        Write-Host "Erro ao criar o projeto"
        Exit 1
    }
}