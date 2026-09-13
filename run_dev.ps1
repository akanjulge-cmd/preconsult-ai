# PreConsult AI Development Launcher
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " Starting PreConsult AI Development Suite " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

$env:Path = "C:\Users\ANJALI\nodejs;" + $env:Path

# Check backend venv
$backendPython = ".\backend\venv\Scripts\python.exe"
if (-Not (Test-Path $backendPython)) {
    Write-Host "[ERROR] Backend virtual environment not found. Please run: python -m venv backend\venv" -ForegroundColor Red
    exit 1
}

Write-Host "[1/2] Starting FastAPI Backend on http://127.0.0.1:8000 ..." -ForegroundColor Green
$backendProc = Start-Process -FilePath $backendPython -ArgumentList "-m uvicorn main:app --host 127.0.0.1 --port 8000 --reload" -WorkingDirectory ".\backend" -PassThru

Start-Sleep -Seconds 2

Write-Host "[2/2] Starting Vite Frontend on http://127.0.0.1:3000 ..." -ForegroundColor Green
Set-Location ".\frontend"
$npmCmd = "C:\Users\ANJALI\nodejs\npm.cmd"
Start-Process -FilePath $npmCmd -ArgumentList "run dev" -WorkingDirectory "."

Write-Host "System is online!" -ForegroundColor Cyan
Write-Host "Frontend: http://127.0.0.1:3000" -ForegroundColor Yellow
Write-Host "Backend:  http://127.0.0.1:8000 (Docs: http://127.0.0.1:8000/docs)" -ForegroundColor Yellow
