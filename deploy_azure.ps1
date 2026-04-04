# NearDrop Azure Deployment Script (No Containers)
# Usage: ./deploy_azure.ps1 -AppName "neardrop-api" -Region "eastus"

param (
    [Parameter(Mandatory=$true)]
    [string]$AppName,
    
    [Parameter(Mandatory=$false)]
    [string]$Region = "eastus"
)

$ResourceGroup = "$AppName-rg"
$AppServicePlan = "$AppName-plan"
$BackendWebApp = "$AppName-backend"
$SwaDispatcher = "$AppName-dispatcher"
$SwaCustomer = "$AppName-customer"

Write-Host "--- Starting Azure Infrastructure Setup for NearDrop ---" -ForegroundColor Cyan

# 1. Create Resource Group
Write-Host "Creating Resource Group: $ResourceGroup..."
az group create --name $ResourceGroup --location $Region

# 2. Create App Service Plan (Free F1 or Basic B1)
Write-Host "Creating App Service Plan..."
az appservice plan create --name $AppServicePlan --resource-group $ResourceGroup --sku B1 --is-linux

# 3. Create Web App for Python 3.11
Write-Host "Creating Backend Web App..."
az webapp create --name $BackendWebApp --resource-group $ResourceGroup --plan $AppServicePlan --runtime "PYTHON:3.11"

# 4. Create Static Web Apps
Write-Host "Creating Static Web App for Dispatcher..."
$dispatcherSwa = az staticwebapp create --name $SwaDispatcher --resource-group $ResourceGroup --location "eastus2" --source "https://github.com/Rahul-14507/DPWH038" --branch "main" --app-location "dispatcher_ops" --output-location "dist" --login-with-github

Write-Host "Creating Static Web App for Customer..."
$customerSwa = az staticwebapp create --name $SwaCustomer --resource-group $ResourceGroup --location "eastus2" --source "https://github.com/Rahul-14507/DPWH038" --branch "main" --app-location "customer_portal" --output-location "dist" --login-with-github

# 5. Extract Deployment Tokens (User needs to add these to GitHub Secrets)
Write-Host "`n--- IMPORTANT: ADD THESE TO GITHUB SECRETS ---" -ForegroundColor Yellow
Write-Host "Go to: https://github.com/Rahul-14507/DPWH038/settings/secrets/actions"

$dispatcherToken = az staticwebapp secrets list --name $SwaDispatcher --resource-group $ResourceGroup --query "properties.apiKey" -o tsv
$customerToken = az staticwebapp secrets list --name $SwaCustomer --resource-group $ResourceGroup --query "properties.apiKey" -o tsv

Write-Host "`n1. AZURE_STATIC_WEB_APPS_API_TOKEN_DISPATCHER:" -ForegroundColor Green
Write-Host $dispatcherToken
Write-Host "`n2. AZURE_STATIC_WEB_APPS_API_TOKEN_CUSTOMER:" -ForegroundColor Green
Write-Host $customerToken
Write-Host "`n3. AZURE_WEBAPP_NAME:" -ForegroundColor Green
Write-Host $BackendWebApp

Write-Host "`n--- Setup Complete! Once you add the secrets above and push code, GitHub Actions will handle the rest. ---" -ForegroundColor Cyan
