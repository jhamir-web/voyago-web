# Firebase Deployment Script
Write-Host "Starting Firebase deployment process..." -ForegroundColor Green

# Step 1: Login to Firebase (requires browser interaction)
Write-Host "`nStep 1: Logging in to Firebase..." -ForegroundColor Yellow
Write-Host "A browser window will open. Please sign in with your Google account." -ForegroundColor Cyan
firebase login

# Step 2: Build the project
Write-Host "`nStep 2: Building the project..." -ForegroundColor Yellow
npm run build

# Step 3: Deploy to Firebase Hosting
Write-Host "`nStep 3: Deploying to Firebase Hosting..." -ForegroundColor Yellow
firebase deploy --only hosting

Write-Host "`nDeployment complete!" -ForegroundColor Green
Write-Host "Your app is available at:" -ForegroundColor Cyan
Write-Host "  - https://voyago-a19e6.web.app" -ForegroundColor White
Write-Host "  - https://voyago-a19e6.firebaseapp.com" -ForegroundColor White



