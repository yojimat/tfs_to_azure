<#
.Description
Script para migração de um projeto com código fonte tfs antigo para o novo Azure DevOps.
Para execução do script a ferramenta 'gittfs'() deve estar instalada, e no PATH do sistema operacional.
#> 

param(
    [String]$NomeProjeto,
    [String]$BaseAzureUrl,
    [String]$BaseTfsUrl,
    [switch]$Help
)

if ($Help) {
    Write-Host "Exemplo: "
    Write-Host ".\MigraRepositorioTfsParaGitAzure.ps1 -NomeProjeto <nomeProjeto> -BaseAzureUrl <urlBase> -BaseTfsUrl <urlBase> [-Help]"
}
else {
    Write-Host "Clonando repositório..."
    Set-Location .\repos
    # Projeto já é migrado para GIT quando vem do TFS
    git-tfs clone $BaseTfsUrl "$/$($NomeProjeto)"
    Set-Location $NomeProjeto
    git remote add origin $BaseAzureUrl/$NomeProjeto/_git/$NomeProjeto
    git gc
    git-tfs cleanup
    git push -u origin --all -q | Out-Null
    Set-Location ..
    Remove-Item -Force -Recurse ".\\$($NomeProjeto)\\"
    Set-Location ..
    Write-Host "Projeto '$($NomeProjeto)' migrado com sucesso!"
}